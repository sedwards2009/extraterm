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

    console.log("Writing stuff");
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
    setTimeout(() => {console.log('bye bye')}, 1000);
  };

  writerStream.on('open', () => {
    console.log("Writer recevied 'open' event.");
    startReading2();
  });

  writerStream.on('drain', () => {
    console.log("Writer received 'drain' event.");
    wait = false;
    writeStuff();
  });

  setTimeout(writeStuff, 100);

  startReading2();
}

function startReading2() {
  const readerStream = writerReaderFile.createReadStream();

  readerStream.on('readable', () => {
    const chunk = readerStream.read();
    if (chunk != null) {
      console.log("Client reader got: " + chunk.toString());
    } else {
      console.log("Client reader got: null");
    }
  });
  readerStream.on('end', () => {
    console.log("Client reader received 'end' event.");
  });
  readerStream.on('close', () => {
    console.log("Client reader received 'close' event.");
  });
}

main();