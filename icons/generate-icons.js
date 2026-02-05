/**
 * Generate simple placeholder PNG icons using pure JavaScript
 * These are valid PNG files that Chrome can use
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const sizes = [16, 32, 48, 128];

// CRC32 calculation
function crc32(data) {
  let crc = 0xffffffff;
  const table = [];

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBytes = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const crcData = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));

  return Buffer.concat([length, typeBytes, data, crc]);
}

function createPNG(size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr.writeUInt8(8, 8);        // bit depth
  ihdr.writeUInt8(2, 9);        // color type (RGB)
  ihdr.writeUInt8(0, 10);       // compression
  ihdr.writeUInt8(0, 11);       // filter
  ihdr.writeUInt8(0, 12);       // interlace

  // Create image data (gradient from orange to cyan - matching the VST theme)
  const rawData = [];
  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < size; x++) {
      // Create a gradient effect
      const centerX = size / 2;
      const centerY = size / 2;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);
      const t = dist / maxDist;

      // Dark metallic background with orange/cyan accent
      let r, g, b;
      if (dist < size * 0.4) {
        // Inner area - orange gradient
        r = Math.floor(255 * (1 - t * 1.5));
        g = Math.floor(102 * (1 - t * 1.5));
        b = Math.floor(0);
      } else {
        // Outer area - dark metallic
        r = Math.floor(42 + (30 * (1 - t)));
        g = Math.floor(42 + (30 * (1 - t)));
        b = Math.floor(42 + (30 * (1 - t)));
      }

      rawData.push(Math.max(0, Math.min(255, r)));
      rawData.push(Math.max(0, Math.min(255, g)));
      rawData.push(Math.max(0, Math.min(255, b)));
    }
  }

  const compressedData = zlib.deflateSync(Buffer.from(rawData), { level: 9 });

  const chunks = [
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressedData),
    createChunk('IEND', Buffer.alloc(0))
  ];

  return Buffer.concat(chunks);
}

// Generate icons
const iconsDir = __dirname;

sizes.forEach(size => {
  const png = createPNG(size);
  const filename = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Created ${filename}`);
});

console.log('\nIcons generated successfully!');
console.log('For better icons, open generate-icons.html in a browser.');
