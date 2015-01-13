var canvas,
context,
dragging = false,
dragStartLocation,
snapshot,
x1,y1,
x2,y2;
function textbox1() {
	var canvas = document.getElementById("e");
	var context = canvas.getContext("2d");
	context.fillStyle = "blue";
    context.font = "bold 16px Arial";
    context.fillText("Zibri", 100, 100);		
  // body...
}
  

function getCanvasCoordinates(event) {

	var x = event.clientX - canvas.getBoundingClientRect().left,
	y = event.clientY - canvas.getBoundingClientRect().top;
	return {x: x, y: y};
}
function takeSnapshot() {
	snapshot = context.getImageData(0, 0, canvas.width, canvas.height);
}
function restoreSnapshot() {
	context.putImageData(snapshot, 0, 0);
}
function drawLine(x1,y1,x2,y2) {
	context.beginPath();
	context.moveTo(x1,y1);
	context.lineTo(x2,y2);
	console.log("hello");
	context.stroke();
}
function drawCircle(x1,y1,x2,y2) {

	var radius = Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2));
	context.beginPath();
	context.arc(x1, y1, radius, 0, 2 * Math.PI, false);
}
function drawPolygon(x1,y1,x2,y2, sides, angle) {
	var coordinates = [],
	radius = Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2)),
	index = 0;
	for (index = 0; index < sides; index++) {
		coordinates.push({x: x1 + radius * Math.cos(angle), y: y1 - radius * Math.sin(angle)});
		angle += (2 * Math.PI) / sides;
	}
	context.beginPath();
	context.moveTo(coordinates[0].x, coordinates[0].y);
	for (index = 1; index < sides; index++) {
		context.lineTo(coordinates[index].x, coordinates[index].y);
	}
	context.closePath();
}


function draw(x2,y2){
	fillBox=document.getElementById("fillBox");
	radiobutton1=document.getElementById("radiobutton1");
	radiobutton2=document.getElementById("radiobutton2");
	radiobutton3=document.getElementById("radiobutton3");
	
	if(fillBox.checked){
		context.fill();
	}

	if(radiobutton1.checked ==true ){
		drawLine(x1,y1,x2,y2);
	}
	if(radiobutton2.checked==true){
		drawCircle(x1,y1,x2,y2);
	}
	if(radiobutton3.checked==true){
		drawPolygon(x1,y1,x2,y2,8,Math.PI/4);
	}
	if(fillBox.checked){
		context.fill();
	}
	else{
		context.stroke();
	}

}
function dragStart(event) {
	dragging = true;
	dragStartLocation = getCanvasCoordinates(event);
	takeSnapshot();
	x1=dragStartLocation.x;
	y1=dragStartLocation.y;
}
function drag(event) {
	var position;
	if (dragging === true) {
		restoreSnapshot();
		position = getCanvasCoordinates(event);
		x2=position.x;
		y2=position.y;

		draw(x2,y2);
		draw(position, "polygon");
	}
}
function dragStop(event) {
	dragging = false;
	restoreSnapshot();
	var position = getCanvasCoordinates(event);
	draw(x2,y2, "polygon");
	x2=position.x;
	y2=position.y;
}
function init() {
	canvas = document.getElementById("canvas");
	context = canvas.getContext('2d');
	context.strokeStyle = 'green';
	context.fillStyle = '#00B0FF';
	context.lineWidth = 4;
	context.lineCap = 'round';
	canvas.addEventListener('mousedown', dragStart, false);
	canvas.addEventListener('mousemove', drag, false);
	canvas.addEventListener('mouseup', dragStop, false);
}
window.addEventListener('load', init, false);




