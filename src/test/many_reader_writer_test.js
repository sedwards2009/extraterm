const fs = require('fs');
const WriterReaderFile = require('../main_process/bulk_file_handling/WriterReaderFile');
const readerHandle = null;

const filename = 'testfile.txt';

let writerReaderFile = null;

function main() {
  writerReaderFile = new WriterReaderFile.WriterReaderFile(filename);
  const writerStream = writerReaderFile.getWriteStream();
  
  let line = 0;
  let wait = false;
  let writing = true;

  const writeStuff = () => {
    if ( ! writing) {
      return;
    }

    console.log("write stuff");
    if (line < 100) {
      const data = "Line: " + line + "------------------------------------------------------------------------------------------\n";
      line++;
      if ( ! writerStream.write(data, 'utf8')) {
        wait = true;
      }
      setTimeout(writeStuff, 100);
      return;
    }
    writerStream.end();
  };

  writerStream.on('open', () => {
    console.log("open event!");
    startReading2();
  });

  writerStream.on('drain', () => {
    console.log("drained!");
    wait = false;
    writeStuff();
  });

  setTimeout(writeStuff, 100);

  startReading2();
}

function startReading() {
  const readerStream = fs.createReadStream(filename);
  readerStream.on('data', (chunk) => {
    console.log("Read: " + chunk.toString());
  });
  readerStream.on('end', () => {
    console.log("Reader end event!");
  });
  readerStream.on('close', () => {
    console.log("Reader close event!");
  });
}

function startReading2() {
  const readerStream = writerReaderFile.createReadStream();

  // const readerStream = fs.createReadStream(filename);
  readerStream.on('readable', () => {
    const chunk = readerStream.read();
    if (chunk != null) {
      console.log("Read: " + chunk.toString());
    }
  });
  readerStream.on('end', () => {
    console.log("Reader end event!");
  });
  readerStream.on('close', () => {
    console.log("Reader close event!");
  });
}

main();