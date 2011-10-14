# Socket.io and anti-virus / firewall software

All tests were done with only one software package installed. VM was rolled back
to a clean snapshot after each test run. If at all possible, I tried not to
change any settings, assuming most users in the Joe Sixpack category won't do
so, either. If I did make changes, I've noted them.

I've done two tests:

* with no special firewall rules on the host machine
* with port 4000 blocked on the host machine

The client will initially try to connect to port 4000 and fall back to
ports 80, then 843, if that doesn't work.

Browser cache was disabled, cookies cleared between each testing run. I used
Chrome and Firefox (3.something). Where possible, I checked in IE as well, but
since IE doesn't kill cookies when you tell it to, I mostly tried in browsers
that do.

## Windows Defender

* Doesn't seem to have any noticable effect on any browser / port combo

## Avast Internet Security

The only change I made was removing the local network from the friends list.
Production sites tend to be outside that range as well.

* With no firewall active, all browsers connect to port 4000.
* FF / IE, firewall blocks 4000: both 80 and 843 work.
* Chrome, FW: Oh dear, Avast eats our WebSocket at port 80. This is what got me
  to add port 843 to the list of options in the first place (well, @3rd-Eden
  told me, actually). Lo and behold: port 843 *works*.

## McAfee Total Protection 2011

Interestingly enough, McAfee notified me of a Trojan my VM appeared to have, and
that Windows Defender and Avast never mentioned. Interesting.

* With no firewall active, all browsers connect to port 4000.  
* Firewall on: Both 80 and 843 work, for all browsers.

## Norton Internet Security 2011

* Chrome can do its Websockets magic through any available port
* Other browsers can connect through any available port

## ESET Smart Security 5

* Chrome can do its Websockets magic through any available port
* Other browsers can connect through any available port

## ZoneAlarm Extreme Security

* Chrome can do its Websockets magic through any available port
* Other browsers can connect through any available port

## Panda Internet Security

* Chrome can do its Websockets magic through any available port
* Other browsers can connect through any available port

## Comodo Internet Security Pro 2011

*To do*

## Comodo Firewall Free Version

*To do*

## AVG

*To do*
