// Copyright: Hiroshi Ichikawa <http://gimite.net/en/>
// License: New BSD License
// Reference: http://dev.w3.org/html5/websockets/
// Reference: http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-31

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

public class WebSocketStateEvent extends Event {
  
  public var readyState:int;
  public var bufferedAmount:int;
  
  public function WebSocketStateEvent(type:String, readyState:int, bufferedAmount:int) {
    super(type);
    this.readyState = readyState;
    this.bufferedAmount = bufferedAmount;
  }
  
}

}
