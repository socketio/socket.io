/*
Copyright � 2006 Adobe Systems Incorporated

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.


THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/


/*
 * The Bridge class, responsible for navigating JS instances
 */
package bridge
{

/*
 * imports
 */
import flash.external.ExternalInterface;
import flash.utils.Timer;
import flash.events.*;
import flash.display.DisplayObject;
import flash.system.ApplicationDomain;
import flash.utils.Dictionary;
import flash.utils.setTimeout;

import mx.collections.errors.ItemPendingError;
import mx.core.IMXMLObject;

import flash.utils.getQualifiedClassName;
import flash.utils.describeType;
import flash.events.TimerEvent;

/**
 * The FABridge class, responsible for proxying AS objects into javascript
 */
public class FABridge extends EventDispatcher implements IMXMLObject
{

    //holds a list of stuff to call later, to break the recurrence of the js <> as calls
    //you must use the full class name, as returned by the getQualifiedClassName() function
    public static const MethodsToCallLater:Object = new Object();
    MethodsToCallLater["mx.collections::ArrayCollection"]="refresh,removeItemAt";

    public static const EventsToCallLater:Object = new Object();
    EventsToCallLater["mx.data.events::UnresolvedConflictsEvent"]="true";
    EventsToCallLater["mx.events::PropertyChangeEvent"]="true";
    
    public static const INITIALIZED:String = "bridgeInitialized";

    // constructor
    public function FABridge()
    {
        super();
        initializeCallbacks();
    }

    // private vars

    /**
     * stores a cache of descriptions of AS types suitable for sending to JS
     */
    private var localTypeMap:Dictionary = new Dictionary();

    /**
     * stores an id-referenced dictionary of objects exported to JS
     */
    private var localInstanceMap:Dictionary = new Dictionary();

    /**
     * stores an id-referenced dictionary of functions exported to JS
     */
    private var localFunctionMap:Dictionary = new Dictionary();

    /**
     * stores an id-referenced dictionary of proxy functions imported from JS
     */
    private var remoteFunctionCache:Dictionary = new Dictionary();

    /**
     * stores a list of custom serialization functions
     */
    private var customSerializersMap:Dictionary = new Dictionary();

    /**
     * stores a map of object ID's and their reference count
     */
    private var refMap:Dictionary = new Dictionary();
    /**
     * a local counter for generating unique IDs
     */
    private var nextID:Number = 0;

    private var lastRef:int;

    /* values that can't be serialized natively across the bridge are packed and identified by type.
       These constants represent different serialization types */
    public static const TYPE_ASINSTANCE:uint = 1;
    public static const TYPE_ASFUNCTION:uint = 2;
    public static const TYPE_JSFUNCTION:uint = 3;
    public static const TYPE_ANONYMOUS:uint = 4;

    private var _initChecked:Boolean = false;

    // properties

    //getters and setters for the main component in the swf - the root
    public function get rootObject():DisplayObject {return _rootObject;}
    public function set rootObject(value:DisplayObject):void
    {
        _rootObject = value;
        checkInitialized();
    }
    
    /**
     * the bridge name
     */
    public var bridgeName:String;
    private var _registerComplete:Boolean = false;
    
    /**
     * increment the reference count for an object being passed over the bridge
     */
    public function incRef(objId:int):void
    {
        if(refMap[objId] == null) {
            //the object is being created; we now add it to the map and set its refCount = 1
            refMap[objId] = 1;
        } else {
            refMap[objId] = refMap[objId] +1;
        }
    }

    /**
     * when an object has been completely passed to JS its reference count is decreased with 1
     */
    public function releaseRef(objId:int):void
    {
        if(refMap[objId] != null)
        {
            var newRefVal:int = refMap[objId] - 1;
            // if the object exists in the referenceMap and its count equals or has dropped under 0 we clean it up
            if(refMap[objId] != null && newRefVal <= 0)
            {
                delete refMap[objId];
                delete localInstanceMap[objId];
            }
            else
            {
                refMap[objId] = newRefVal;
            }
        }
    }

    /**
     * attaches the callbacks to external interface
     */
    public function initializeCallbacks():void
    {
        if (ExternalInterface.available == false)
        {
            return;
        }

        ExternalInterface.addCallback("getRoot", js_getRoot);
        ExternalInterface.addCallback("getPropFromAS", js_getPropFromAS);
        ExternalInterface.addCallback("setPropInAS", js_setPropertyInAS);
        ExternalInterface.addCallback("invokeASMethod", js_invokeMethod);
        ExternalInterface.addCallback("invokeASFunction", js_invokeFunction);
        ExternalInterface.addCallback("releaseASObjects", js_releaseASObjects);
        ExternalInterface.addCallback("create", js_create);
        ExternalInterface.addCallback("releaseNamedASObject",js_releaseNamedASObject);
        ExternalInterface.addCallback("incRef", incRef);
        ExternalInterface.addCallback("releaseRef", releaseRef);
    }

    private var _rootObject:DisplayObject;

    private var _document:DisplayObject;
    
    /**
     * called to check whether the bridge has been initialized for the specified document/id pairs
     */
    public function initialized(document:Object, id:String):void
    {
        _document = (document as DisplayObject);

        if (_document != null)
        {
            checkInitialized();
        }
    }
    
    private function get baseObject():DisplayObject
    {
        return (rootObject == null)? _document:rootObject;
    }


    private function checkInitialized():void
    {
        if(_initChecked== true)
        {
            return;
        }
        _initChecked = true;

        // oops! timing error. Player team is working on it.
        var t:Timer = new Timer(200,1);
        t.addEventListener(TimerEvent.TIMER,auxCheckInitialized);
        t.start();
    }

    /** 
     * auxiliary initialization check that is called after the timing has occurred
     */
    private function auxCheckInitialized(e:Event):void
    {

        var bCanGetParams:Boolean = true;

        try
        {
            var params:Object = baseObject.root.loaderInfo.parameters;
        }
        catch (e:Error)
        {
            bCanGetParams = false;
        }

        if (bCanGetParams == false)
        {
            var t:Timer = new Timer(100);
            var timerFunc:Function = function(e:TimerEvent):void
            {
                if(baseObject.root != null)
                {
                    try
                    {
                        bCanGetParams = true;
                        var params:Object = baseObject.root.loaderInfo.parameters;
                    }
                    catch (err:Error)
                    {
                        bCanGetParams = false;
                    }
                    if (bCanGetParams)
                    {
                        t.removeEventListener(TimerEvent.TIMER, timerFunc);
                        t.stop();
                        dispatchInit();
                    }
                }
            }
            t.addEventListener(TimerEvent.TIMER, timerFunc);
            t.start();
        }
        else
        {
            dispatchInit();
        }
    }

    /**
     * call into JS to annunce that the bridge is ready to be used
     */
    private function dispatchInit(e:Event = null):void
    {
        if(_registerComplete == true)
        {
            return;
        }

        if (ExternalInterface.available == false)
        {
            return;
        }

        if (bridgeName == null)
        {
            bridgeName = baseObject.root.loaderInfo.parameters["bridgeName"];

            if(bridgeName == null)
            {
                bridgeName = "flash";
            }
        }

        _registerComplete = ExternalInterface.call("FABridge__bridgeInitialized", [bridgeName]);
        dispatchEvent(new Event(FABridge.INITIALIZED));
    }

    // serialization/deserialization

    /** serializes a value for transfer across the bridge.  primitive types are left as is.  Arrays are left as arrays, but individual
     * values in the array are serialized according to their type.  Functions and class instances are inserted into a hash table and sent
     * across as keys into the table.
     *
     * For class instances, if the instance has been sent before, only its id is passed. If This is the first time the instance has been sent,
     * a ref descriptor is sent associating the id with a type string. If this is the first time any instance of that type has been sent
     * across, a descriptor indicating methods, properties, and variables of the type is also sent across
     */
    public function serialize(value:*, keep_refs:Boolean=false):*
    {
        var result:* = {};
        result.newTypes = [];
        result.newRefs = {};

        if (value is Number || value is Boolean || value is String || value == null || value == undefined  || value is int || value is uint)
        {
            result = value;
        }
        else if (value is Array)
        {
            result = [];
            for(var i:int = 0; i < value.length; i++)
            {
                result[i] = serialize(value[i], keep_refs);
            }
        }
        else if (value is Function)
        {
            // serialize a class
            result.type = TYPE_ASFUNCTION;
            result.value = getFunctionID(value, true);
        }
        else if (getQualifiedClassName(value) == "Object")
        {
            result.type = TYPE_ANONYMOUS;
            result.value = value;
        }
        else
        {
            // serialize a class
            result.type = TYPE_ASINSTANCE;
            // make sure the type info is available
            var className:String = getQualifiedClassName(value);

            var serializer:Function = customSerializersMap[className];

            // try looking up the serializer under an alternate name
            if (serializer == null)
            {
                if (className.indexOf('$') > 0)
                {
                    var split:int = className.lastIndexOf(':');
                    if (split > 0)
                    {
                        var alternate:String = className.substring(split+1);
                        serializer = customSerializersMap[alternate];
                    }
                }
            }

            if (serializer != null)
            {
                return serializer.apply(null, [value, keep_refs]);
            }
            else
            {
                if (retrieveCachedTypeDescription(className, false) == null)
                {
                    try
                    {
                        result.newTypes.push(retrieveCachedTypeDescription(className, true));
                    }
                    catch(err:Error)
                    {
                        var interfaceInfo:XMLList = describeType(value).implementsInterface;
                        for each (var interf:XML in interfaceInfo)
                        {
                            className = interf.@type.toString();
                            if (retrieveCachedTypeDescription(className, false) == null){
                                result.newTypes.push(retrieveCachedTypeDescription(className, true));
                            } //end if push new data type
                       
                        } //end for going through interfaces
                        var baseClass:String = describeType(value).@base.toString();
                        if (retrieveCachedTypeDescription(baseClass, false) == null){
                            result.newTypes.push(retrieveCachedTypeDescription(baseClass, true));
                        } //end if push new data type
                    }
                }

                // make sure the reference is known
                var objRef:Number = getRef(value, false);
                var should_keep_ref:Boolean = false;
                if (isNaN(objRef))
                {
                    //create the reference if necessary
                    objRef = getRef(value, true);
                    should_keep_ref = true;
                }
                
                result.newRefs[objRef] = className;
                //trace("serializing new reference: " + className + " with value" + value);
                
                //the result is a getProperty / invokeMethod call. How can we know how much you will need the object ? 
                if (keep_refs && should_keep_ref) {
                    incRef(objRef);
                }
                result.value = objRef;
            }
        }
        return result;
    }

    /**
     * deserializes a value passed in from javascript. See serialize for details on how values are packed and
     * unpacked for transfer across the bridge.
     */
    public function deserialize(valuePackage:*):*
    {
        var result:*;
        if (valuePackage is Number || valuePackage is Boolean || valuePackage is String || valuePackage === null || valuePackage === undefined  || valuePackage is int || valuePackage is uint)
        {
            result = valuePackage;
        }
        else if(valuePackage is Array)
        {
            result = [];
            for (var i:int = 0; i < valuePackage.length; i++)
            {
                result[i] = deserialize(valuePackage[i]);
            }
        }
        else if (valuePackage.type == FABridge.TYPE_JSFUNCTION)
        {
            result = getRemoteFunctionProxy(valuePackage.value, true);
        }
        else if (valuePackage.type == FABridge.TYPE_ASFUNCTION)
        {
            throw new Error("as functions can't be passed back to as yet");
        }
        else if (valuePackage.type == FABridge.TYPE_ASINSTANCE)
        {
            result = resolveRef(valuePackage.value);
        }
        else if (valuePackage.type == FABridge.TYPE_ANONYMOUS)
        {
            result = valuePackage.value;
        }
        return result;
    }

    public function addCustomSerialization(className:String, serializationFunction:Function):void
    {
        customSerializersMap[className] = serializationFunction;
    }


    // type management

    /**
     * retrieves a type description for the type indicated by className, building one and caching it if necessary
     */
    public function retrieveCachedTypeDescription(className:String, createifNecessary:Boolean):Object
    {
        if(localTypeMap[className] == null && createifNecessary == true)
        {
            localTypeMap[className] = buildTypeDescription(className);
        }
        return localTypeMap[className];
    }

    public function addCachedTypeDescription(className:String, desc:Object):Object
    {
        if (localTypeMap[className] == null)
        {
            localTypeMap[className] = desc;
        }
        return localTypeMap[className];
    }

    /**
     * builds a type description for the type indiciated by className
     */
    public function buildTypeDescription(className:String):Object
    {
        var desc:Object = {};

        className = className.replace(/::/,".");

        var objClass:Class = Class(ApplicationDomain.currentDomain.getDefinition(className));

        var xData:XML = describeType(objClass);

        desc.name = xData.@name.toString();

        var methods:Array = [];
        var xMethods:XMLList = xData.factory.method;
        for (var i:int = 0; i < xMethods.length(); i++)
        {
            methods.push(xMethods[i].@name.toString());
        }
        desc.methods = methods;

        var accessors:Array = [];
        var xAcc:XMLList = xData.factory.accessor;
        for (i = 0; i < xAcc.length(); i++)
        {
            accessors.push(xAcc[i].@name.toString());
        }
        xAcc = xData.factory.variable;
        for (i = 0; i < xAcc.length(); i++)
        {
            accessors.push(xAcc[i].@name.toString());
        }
        desc.accessors = accessors;

        return desc;
    }

// instance mgmt

    /**
     * resolves an instance id passed from JS to an instance previously cached for representing in JS
     */
    private function resolveRef(objRef:Number):Object
    {
        try
        {
            return (objRef == -1)? baseObject : localInstanceMap[objRef];
        }
        catch(e:Error)
        {
            return serialize("__FLASHERROR__"+"||"+e.message);
        }

        return (objRef == -1)? baseObject : localInstanceMap[objRef];
    }

    /**
     * returns an id associated with the object provided for passing across the bridge to JS
     */
    public function getRef(obj:Object, createIfNecessary:Boolean):Number
    {
        try
        {
            var ref:Number;

            if (createIfNecessary)
            {
                var newRef:Number = nextID++;
                localInstanceMap[newRef] = obj;
                ref = newRef;
            }
            else
            {
                for (var key:* in localInstanceMap)
                {
                    if (localInstanceMap[key] === obj)
                    {
                        ref = key;
                        break;
                    }
                }
            }
        }
        catch(e:Error)
        {
             return serialize("__FLASHERROR__"+"||"+e.message)
        }
        
        return ref;
    }


    // function management

    /**
     * resolves a function ID passed from JS to a local function previously cached for representation in JS
     */
    private function resolveFunctionID(funcID:Number):Function
    {
        return localFunctionMap[funcID];
    }

    /**
     * associates a unique ID with a local function suitable for passing across the bridge to proxy in Javascript
     */
    public function getFunctionID(f:Function, createIfNecessary:Boolean):Number
    {
        var ref:Number;

        if (createIfNecessary)
        {
            var newID:Number = nextID++;
            localFunctionMap[newID] = f;
            ref = newID;
        }
        else
        {
            for (var key:* in localFunctionMap)
            {
                if (localFunctionMap[key] === f) {
                    ref = key;
                }
                break;
            }
        }

        return ref;
    }

    /**
     * returns a proxy function that represents a function defined in javascript. This function can be called syncrhonously, and will
     * return any values returned by the JS function
     */
    public function getRemoteFunctionProxy(functionID:Number, createIfNecessary:Boolean):Function
    {
        try
        {
            if (remoteFunctionCache[functionID] == null)
            {
                remoteFunctionCache[functionID] = function(...args):*
                {
                    var externalArgs:Array = args.concat();
                    externalArgs.unshift(functionID);
                    var serializedArgs:* = serialize(externalArgs, true);
                    
                    if(checkToThrowLater(serializedArgs[1]))
                    {
                        setTimeout(function a():* {   
                            try {                            
                                var retVal:* = ExternalInterface.call("FABridge__invokeJSFunction", serializedArgs);
                                for(var i:int = 0; i<serializedArgs.length; i++)
                                {
                                    if(typeof(serializedArgs[i]) == "object" && serializedArgs[i]!=null) 
                                    {
                                        releaseRef(serializedArgs[i].value);
                                    }
                                }
                                return retVal;
                            }
                            catch(e:Error)
                            {
                                return serialize("__FLASHERROR__"+"||"+e.message);
                            }
                        },1);
                    }
                    else
                    {
                        var retVal:* = ExternalInterface.call("FABridge__invokeJSFunction", serializedArgs);
                        for(var i:int = 0; i<serializedArgs.length; i++)
                        {
                            if(typeof(serializedArgs[i]) == "object" && serializedArgs[i]!=null) 
                            {
                                releaseRef(serializedArgs[i].value);
                            }
                        }
                        return retVal;
                    }
                }
            }
        }
        catch(e:Error)
        {
            return serialize("__FLASHERROR__"+"||"+e.message);
        }

        return remoteFunctionCache[functionID];
    }
    
    /**
     * function that checks if the object on which we are working demands that it should be called at a later time, breaking the call chain
     * we check the actual object, as well as the bsae class and interfaces
     */
    private function checkToThrowLater(obj:Object):Boolean
    {
        obj = resolveRef(obj.value);
        var className:String = getQualifiedClassName(obj);
        var classInfo:XML = describeType(obj);
        
        if (FABridge.EventsToCallLater[className] != null) {
                return true;
        }

        //check if this class doesn't inherit from one of the entries in the table
        var inheritanceInfo:XMLList = describeType(obj).extendsClass;
        for each (var inherit:XML in inheritanceInfo)
        {
            className = inherit.@type.toString();
            if (FABridge.EventsToCallLater[className] != null) {
                    return true;
            }
        } //end for going through inheritance tree
        
        //if we're still here, check the interfaces as well

        var interfaceInfo:XMLList = describeType(obj).implementsInterface;
        for each (var interf:XML in interfaceInfo)
        {
            className = interf.@type.toString();
            if (FABridge.EventsToCallLater[className] != null) {
                    return true;
            }
        } //end for going through inheritance tree

        //if nothing was found, return false, so the function gets executed
        return false;        
    }

    // callbacks exposed to JS

    /**
     * called to fetch a named property off the instanced associated with objID
     */
    public function js_getPropFromAS(objID:Number, propName:String):*
    {
        incRef(objID);
        try
        {
            var obj:Object = resolveRef(objID); 
            var ret:* = serialize(obj[propName], true);
            releaseRef(objID);
            return ret;
        }
        catch (e:ItemPendingError)
        {
            releaseRef(objID);
            //ItemPendingError
            //return serialize("an error occcured with" + obj[propName]);
        }
        catch(e:Error)
        {
            releaseRef(objID);
            return serialize("__FLASHERROR__" + "||" + e.message);
        }    
    }

    /**
     * called to set a named property on the instance associated with objID
     */
    private function js_setPropertyInAS(objID:Number, propRef:String, value:*):*
    {
        incRef(objID);
        try {
            var obj:Object = resolveRef(objID);
            obj[propRef] = deserialize(value);
            releaseRef(objID);
        }
        catch(e:Error)
        {
            releaseRef(objID);
            return serialize("__FLASHERROR__" + "||" + e.message);
        }
    }

    /**
     * accessor for retrieveing a proxy to the root object from JS
     */
    private function js_getRoot():*
    {
        try
        {
            //always get the root; this is the same as the get property, only it is the root object
            var objRef:Number = getRef(baseObject, false);
            if (isNaN(objRef))
            {
                //create the reference if necessary
                objRef = getRef(baseObject, true);
                incRef(objRef);
            }
            return serialize(baseObject);
        }
        catch(e:Error)
        {
            return serialize("__FLASHERROR__"+"||"+e.message);
        }
    }

    /** 
     * called to invoke a function or closure associated with funcID
     */
    private function js_invokeFunction(funcID:Number, args:Object):*
    {
        var result:*;
        try
        {
            var func:Function = resolveFunctionID(funcID);
            if(func != null)
                result = func.apply(null, deserialize(args));

            return serialize(result, true);
        }
        catch(e:Error)
        {
            return serialize("__FLASHERROR__"+"||"+e.message);
        }
    }

    /**
     * called to invoke a named method on the object associated with objID
     */
    private function js_invokeMethod(objID:Number, methodName:String, args:Object):*
    {
        incRef(objID);
        try
        {
            var obj:Object = resolveRef(objID);
            var result:*;

            //check if the method is callable right now, or later
            var callLater:Boolean = checkToExecuteLater(obj, methodName);

            if (callLater) {
                var t:Timer = new Timer(200, 1);
                t.addEventListener(TimerEvent.TIMER, function():void {
                    var ret_inner:* = serialize(obj[methodName].apply(null, deserialize(args)), true);
                    releaseRef(objID);
                });
                t.start();
            } else {
                var ret:* = serialize(obj[methodName].apply(null, deserialize(args)), true);
                releaseRef(objID);
                return ret;
            }
        }
        catch (e:ItemPendingError)
        {
            releaseRef(objID);
            // ignore ItemPendingError
        }
        catch(e:Error)
        {
            releaseRef(objID);
            return serialize("__FLASHERROR__" + "||" + e.message);
        }
    }
    
    /**
     * method that performs a check on the specified object and method to see if their execution should be delayed or not
     * it checks the object, its base class and implemented interfaces
     */
    private function checkToExecuteLater(obj:Object, methodName:String):Boolean
    {
        var methods:String;
        var className:String = getQualifiedClassName(obj);
        var classInfo:XML = describeType(obj);
        
        if (FABridge.MethodsToCallLater[className] != null) {
            methods = FABridge.MethodsToCallLater[className];
            //must call later
            if(methods.match(methodName)) 
            {
                return true;
            }
        }

        //check if this class doesn't inherit from one of the entries in the table
        var inheritanceInfo:XMLList = describeType(obj).extendsClass;
        for each (var inherit:XML in inheritanceInfo)
        {
            className = inherit.@type.toString();
            if (FABridge.MethodsToCallLater[className] != null) {
                methods = FABridge.MethodsToCallLater[className];
                //must call later
                if(methods.match(methodName)) 
                {
                    return true;
                }
            }
        } //end for going through inheritance tree
        
        //if we're still here, check the interfaces as well

        var interfaceInfo:XMLList = describeType(obj).implementsInterface;
        for each (var interf:XML in interfaceInfo)
        {
            className = interf.@type.toString();
            if (FABridge.MethodsToCallLater[className] != null) {
                methods = FABridge.MethodsToCallLater[className];
                //must call later
                if(methods.match(methodName)) 
                {
                    return true;
                }
            }
        } //end for going through inheritance tree

        //if nothing was found, return false, so the function gets executed
        return false;        
    }

    /**
     * callback from JS to release all AS Objects from the local cache maps
     */
    private function js_releaseASObjects():void
    {
        localTypeMap = new Dictionary();
        localInstanceMap = new Dictionary();
        localFunctionMap = new Dictionary();
    }
   
    /**
     * callback from JS to release a specific object, identified by its ID
     */
    private function js_releaseNamedASObject(objId:int):Boolean
    {  
        var retVal:Boolean = false;
        if (localInstanceMap[objId] != null)
        {
            delete refMap[objId];
            delete localInstanceMap[objId];        
            retVal = true;
        }
        return retVal;    
    }    
    
    /**
     * callback for js to create a new class instance.
     */

    private function js_create(className:String):*
    {
        try
        {
            var c:Class = Class(ApplicationDomain.currentDomain.getDefinition(className));
            var instance:Object = new c();
        }
        catch(e:Error)
        {
            return serialize("__FLASHERROR__" + "||" + e.message);
        }

        // make sure the reference is known
        var objRef:Number = getRef(instance, true);
        incRef(objRef);
        return serialize(instance);
    }

}
}
