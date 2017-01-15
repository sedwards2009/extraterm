

function printRange(startPoint, endPoint) {
  for (let i=startPoint; i<=endPoint; i++) {
    console.log("12345");
    console.log("1" + String.fromCodePoint(i) + " 45");
    console.log("12345\n");
  }
}

// printRange(0x2700, 0x2700);
// printRange(0x2728, 0x2728);
printRange(0x01f600, 0x01f64f);
// printRange(0x01f30d, 0x01f30d);

// printRange(0x1F300, 0x1F5FF);

// printRange(0x1F600, 0x1F64F);

//printRange(0x1F300, 0x1F5FF);
