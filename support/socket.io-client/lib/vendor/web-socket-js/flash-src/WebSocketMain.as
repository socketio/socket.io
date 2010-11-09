// Copyright: Hiroshi Ichikawa <http://gimite.net/en/>
// License: New BSD License
// Reference: http://dev.w3.org/html5/websockets/
// Reference: http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-76

package {

import flash.display.*;
import flash.events.*;
import flash.external.*;
import flash.net.*;
import flash.system.*;
import flash.utils.*;
import mx.core.*;
import mx.controls.*;
import mx.events.*;
import mx.utils.*;
import bridge.FABridge;

public class WebSocketMain extends Sprite {

  private var policyLoaded:Boolean = false;
  private var callerUrl:String;
  private var debug:Boolean = false;

  public function WebSocketMain() {
    
    // This is to avoid "You are trying to call recursively into the Flash Player ..."
    // error which (I heard) happens when you pass bunch of messages.
    // This workaround was written here:
    // http://www.themorphicgroup.com/blog/2009/02/14/fabridge-error-you-are-trying-to-call-recursively-into-the-flash-player-which-is-not-allowed/
    FABridge.EventsToCallLater["flash.events::Event"] = "true";
    FABridge.EventsToCallLater["WebSocketMessageEvent"] = "true";
    FABridge.EventsToCallLater["WebSocketStateEvent"] = "true";
    
    var fab:FABridge = new FABridge();
    fab.rootObject = this;
    //log("Flash initialized");
    
  }
  
  public function setCallerUrl(url:String):void {
    callerUrl = url;
  }

  public function setDebug(val:Boolean):void {
    debug = val;
  }

  public function create(
      url:String, protocol:String,
      proxyHost:String = null, proxyPort:int = 0,
      headers:String = null):WebSocket {
    loadPolicyFile(null);
    return new WebSocket(this, url, protocol, proxyHost, proxyPort, headers);
  }

  public function getOrigin():String {
    return (URLUtil.getProtocol(this.callerUrl) + "://" +
      URLUtil.getServerNameWithPort(this.callerUrl)).toLowerCase();
  }
  
  public function getCallerHost():String {
    return URLUtil.getServerName(this.callerUrl);
  }

  public function loadPolicyFile(url:String):void {
    if (policyLoaded && !url) return;
    if (!url) {
      url = "xmlsocket://" + URLUtil.getServerName(this.callerUrl) + ":843";
    }
    log("policy file: " + url);
    Security.loadPolicyFile(url);
    policyLoaded = true;
  }

  public function log(message:String):void {
    if (debug) {
      ExternalInterface.call("webSocketLog", encodeURIComponent("[WebSocket] " + message));
    }
  }

  public function error(message:String):void {
    ExternalInterface.call("webSocketError", encodeURIComponent("[WebSocket] " + message));
  }

  public function fatal(message:String):void {
    ExternalInterface.call("webSocketError", encodeURIComponent("[WebSocket] " + message));
    throw message;
  }

}

}
