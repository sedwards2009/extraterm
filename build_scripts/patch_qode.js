/**
 * This file is converted to JS from the file `patchQode.ts` in https://github.com/nodegui/packer
 * Where it was published under the MIT license.
 */

const fs = require("fs");

const PE_SIGNATURE_OFFSET_LOCATION = 0x3c;

function getPESignatureOffset(fd) {
  const PESignatureOffsetBuffer = Buffer.alloc(4);
  fs.readSync(fd, PESignatureOffsetBuffer, 0, 4, PE_SIGNATURE_OFFSET_LOCATION);
  return PESignatureOffsetBuffer.readUInt32LE(0);
}

function validatePESignature(fd, signatureOffset) {
  const PESignatureBuffer = Buffer.alloc(4);
  fs.readSync(fd, PESignatureBuffer, 0, 4, signatureOffset);
  if (PESignatureBuffer.toString() !== "PE\0\0") {
    throw new Error("Not a PE file. aborting");
  }
}

function validatePEImageFormats(fd, optionalHeaderOffset) {
  const magicHeaderBuffer = Buffer.alloc(2);
  fs.readSync(fd, magicHeaderBuffer, 0, 2, optionalHeaderOffset);
  const magicHeaders = magicHeaderBuffer.readUInt16LE(0);
  if (magicHeaders === 0x20b) {
    return "PE32+";
  } else if (magicHeaders === 0x10b) {
    return "PE32";
  } else {
    throw new Error("Unknown PE format!" + magicHeaders);
  }
}

function getOptionalHeaderOffset(signatureOffset) {
  const COFFHeaderOffset = signatureOffset + 4; // add the bytes occupied by the signature
  const COFFHeaderSize = 20; // the fixed coffheadersize
  const OptionalHeaderOffset = COFFHeaderOffset + COFFHeaderSize;
  return OptionalHeaderOffset;
}

function switchIfCui(fd, subsystemOffset) {
  const subsystemBuffer = Buffer.alloc(2);
  fs.readSync(fd, subsystemBuffer, 0, 2, subsystemOffset);
  const subsystem = subsystemBuffer.readUInt16LE(0);
  if (subsystem !== 3) {
    return console.log(
      `Subsystem found to be: ${subsystem}. Not switching.. aborting`
    );
  }
  console.log(`Switching to GUI subsystem IMAGE_SUBSYSTEM_WINDOWS_GUI: ${2}`);
  const GUISubsytemBuffer = Buffer.alloc(2);
  GUISubsytemBuffer.writeUInt16LE(0x02, 0);
  fs.writeSync(fd, GUISubsytemBuffer, 0, 2, subsystemOffset);
}

function switchToGuiSubsystem(filePath) {
  const fd = fs.openSync(filePath, "r+");
  const PESignatureOffset = getPESignatureOffset(fd);
  validatePESignature(fd, PESignatureOffset);
  const optionalHeaderOffset = getOptionalHeaderOffset(PESignatureOffset);
  const imageFormat = validatePEImageFormats(fd, optionalHeaderOffset);
  console.log(`Found a valid ${imageFormat} executable file`);
  const subsystemOffset = optionalHeaderOffset + 68; // From https://docs.microsoft.com/en-us/windows/win32/debug/pe-format#optional-header-windows-specific-fields-image-only
  switchIfCui(fd, subsystemOffset);
  fs.closeSync(fd);
}
exports.switchToGuiSubsystem = switchToGuiSubsystem;
