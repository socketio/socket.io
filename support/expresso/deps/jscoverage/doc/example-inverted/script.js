function go(element) {
  var message;
  if (element.id === 'radio1') {
    message = 'You selected the number 1.';
  }
  else if (element.id === 'radio2') {
    message = 'You selected the number 2.';
  }
  else if (element.id === 'radio3') {
    message = 'You selected the number 3.';
  }
  else if (element.id === 'radio4') {
    message = 'You selected the number 4.';
  }
  var div = document.getElementById('request');
  div.className = 'black';
  div = document.getElementById('result');
  div.innerHTML = '<p>' + message + '</p>';
  div.innerHTML += '<p>If you are running the instrumented version of this program, you can click the "Coverage report" button to view a coverage report.</p>';
}
