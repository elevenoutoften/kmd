import { readFileSync, writeFileSync } from "node:fs";

const ICO_HEADER_BYTES = 6;
const ICO_DIRECTORY_ENTRY_BYTES = 16;

function decodeIcoDimension(value) {
  return value === 0 ? 256 : value;
}

export function parseIcoDirectory(buffer) {
  const reserved = buffer.readUInt16LE(0);
  const type = buffer.readUInt16LE(2);
  const count = buffer.readUInt16LE(4);

  if (reserved !== 0 || type !== 1) {
    throw new Error("Invalid ICO header.");
  }

  return Array.from({ length: count }, (_, index) => {
    const offset = ICO_HEADER_BYTES + index * ICO_DIRECTORY_ENTRY_BYTES;
    return {
      offset,
      width: decodeIcoDimension(buffer[offset]),
      height: decodeIcoDimension(buffer[offset + 1]),
      bitCount: buffer.readUInt16LE(offset + 6),
      bytesInRes: buffer.readUInt32LE(offset + 8),
      imageOffset: buffer.readUInt32LE(offset + 12),
      raw: Buffer.from(buffer.subarray(offset, offset + ICO_DIRECTORY_ENTRY_BYTES)),
    };
  });
}

export function reorderIcoDirectoryLargestFirst(buffer) {
  const entries = parseIcoDirectory(buffer);
  const sortedEntries = [...entries].sort((left, right) => {
    const areaDifference = right.width * right.height - left.width * left.height;
    if (areaDifference !== 0) {
      return areaDifference;
    }

    const bitCountDifference = right.bitCount - left.bitCount;
    if (bitCountDifference !== 0) {
      return bitCountDifference;
    }

    return right.bytesInRes - left.bytesInRes;
  });

  const nextBuffer = Buffer.from(buffer);
  sortedEntries.forEach((entry, index) => {
    const offset = ICO_HEADER_BYTES + index * ICO_DIRECTORY_ENTRY_BYTES;
    entry.raw.copy(nextBuffer, offset);
  });

  return nextBuffer;
}

export function rewriteIcoFileLargestFirst(path) {
  const buffer = readFileSync(path);
  const reordered = reorderIcoDirectoryLargestFirst(buffer);
  writeFileSync(path, reordered);
}
