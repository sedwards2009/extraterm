
const tty = require('tty');

function print(param) {
   process.stdout.write(''+ param);
}

const CSI = "\x1b[";

function moveCursor(x, y) {
  print(CSI);
  print('' + (y+1) + ';' + (x+1) + 'H');
}

function clearScreen() {
  print(CSI);
  print('2J');
}

function markCorners() {
  const cols = process.stdout.columns;
  const rows = process.stdout.rows;
  
  moveCursor(0,0);
  print('L');
  moveCursor(cols-1, 0);
  print('R');
  
  const step = 10;
  for (var i=0; i<cols; i+=10) {
    moveCursor(i,0);
    print( (i/10) % 10);
  }
  
  for (var i=0; i<rows; i++) {
    moveCursor(0,i);
    print(i);
  }
}

const messages = [];
function printMessages() {
  for (var i=0; i<messages.length; i++) {
    moveCursor(5, 2+i);
    print(messages[i]);
  }
  
}

function draw() {
  clearScreen();
  markCorners();

  printMessages();
}

function handleResize() {
  messages.push(`${(new Date()).toISOString().replace(/(T|Z)/g," ").trim()} Columns: ${process.stdout.columns} Rows: ${process.stdout.rows}`);
}

handleResize();
draw();

process.on('SIGINT', () => {
  console.log('Got SIGINT.  Press Control-D to exit.');
});

process.on('SIGWINCH', () => {
  handleResize();
  draw();
});

process.stdin.resume();
