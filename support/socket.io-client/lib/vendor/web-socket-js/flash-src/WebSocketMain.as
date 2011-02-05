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

  private var callerUrl:String;
  private var debug:Boolean = false;
  private var manualPolicyFileLoaded:Boolean = false;

  public function WebSocketMain() {
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
    if (!manualPolicyFileLoaded) {
      loadDefaultPolicyFile(url);
    }
    return new WebSocket(this, url, protocol, proxyHost, proxyPort, headers);
  }

  public function getOrigin():String {
    return (URLUtil.getProtocol(this.callerUrl) + "://" +
      URLUtil.getServerNameWithPort(this.callerUrl)).toLowerCase();
  }
  
  public function getCallerHost():String {
    return URLUtil.getServerName(this.callerUrl);
  }

  private function loadDefaultPolicyFile(wsUrl:String):void {
    var policyUrl:String = "xmlsocket://" + URLUtil.getServerName(wsUrl) + ":843";
    log("policy file: " + policyUrl);
    Security.loadPolicyFile(policyUrl);
  }

  public function loadManualPolicyFile(policyUrl:String):void {
    log("policy file: " + policyUrl);
    Security.loadPolicyFile(policyUrl);
    manualPolicyFileLoaded = true;
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
