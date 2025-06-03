const inputFile = document.getElementById('docxFile');
const processButton = document.getElementById('processBtn');
const opacityRange = document.getElementById('wmOpacity');
const opacityVal = document.getElementById('opacityVal');
const qualitySlider = document.getElementById('jpegQuality');
const textDirection = document.getElementById('textDirection');
const qualityLabel = document.getElementById('jpegQualityValue');

// Get initial button text (button changes to "processing..." during script)
const processButtonText = processButton.innerText;

// Enable button only when a file is selected
inputFile.addEventListener('change', () => {
  processButton.disabled = !inputFile.files.length;
});

// Show opacity value
opacityRange.addEventListener('input', () => {
  opacityVal.textContent = opacityRange.value;
});

// Show JPEG quality value
qualitySlider.addEventListener('input', () => {
  qualityLabel.textContent = qualitySlider.value;
});

async function watermarkImage(arrayBuffer, options) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([arrayBuffer]);
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Watermark setup
      const fontSize = options.fontSize;
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = hexToRGBA(options.colour, options.opacity);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Reset any transform
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Setup text drawing based on direction
      switch (options.textDirection) {
        case 'horizontal':
          drawTiledText(0);
          console.log('horizontal')
          break;
        case 'vertical':
          drawTiledText(Math.PI / 2);
          console.log('vertical')
          break;
        case 'diagonal':
        default:
          drawTiledText(-Math.PI / 4);
          console.log('diagonal')
          break;
      }

      // Helper function to tile text at a rotation angle
      function drawTiledText(rotationAngle) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rotationAngle);

        const textWidth = ctx.measureText(options.text).width;
        const stepX = options.spacing + textWidth;
        const stepY = options.spacing + fontSize;

        const startX = -canvas.height * 1.5;
        const endX = canvas.height * 1.5;
        const startY = -canvas.width * 1.5;
        const endY = canvas.width * 1.5;

        for (let x = startX; x < endX; x += stepX) {
          for (let y = startY; y < endY; y += stepY) {
            ctx.fillText(options.text, x, y);
          }
        }

        // Reset after drawing
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      // Detect original format from options.filename
      const ext = options.filename.split('.').pop().toLowerCase();

      let mimeType = 'image/png';
      let quality = undefined;

      if (ext === 'jpg' || ext === 'jpeg') {
        mimeType = 'image/jpeg';
        quality = options.jpegQuality; // pass jpegQuality here
      } else if (ext === 'png') {
        mimeType = 'image/png';
      } else if (ext === 'gif') {
        mimeType = 'image/png'; // fallback
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Failed to create blob'));
          resolve(blob);
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

// Utility: Convert hex colour + opacity to rgba string
function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

processButton.onclick = async () => {
  if (!inputFile.files.length) {
    alert('Please select a .docx file.');
    return;
  }
  processButton.disabled = true;
  processButton.textContent = 'Processing...';
  
  const file = inputFile.files[0];
  const zip = new JSZip();
  const content = await file.arrayBuffer();
  await zip.loadAsync(content);
  
  const mediaFolder = 'word/media/';
  const files = Object.keys(zip.files);

  // Check if media files (images) are present in document
  const hasMedia = files.some(f => f.startsWith(mediaFolder));
  if (!hasMedia) {
    alert('No images found in the document.');
    processButton.disabled = false;
    processButton.textContent = processButtonText;
    return;
  }

  
  // Get watermark options from UI
  const options = {
    text: document.getElementById('wmText').value.trim() || 'WATERMARK TEXT',
    colour: document.getElementById('wmColour').value,
    opacity: parseFloat(document.getElementById('wmOpacity').value),
    fontSize: parseInt(document.getElementById('wmFontSize').value, 10) || 30,
    spacing: parseInt(document.getElementById('wmSpacing').value, 10) || 300,
    textDirection: textDirection.value,
    jpegQuality: parseFloat(document.getElementById('jpegQuality').value),
  };

  // Supported image extensions/formats
  const supportedImageRegex = /\.(png|jpe?g|gif|bmp|webp|ico)$/i;
  
  try {
    
    // Loop through all files - process if supported file type in media folder
    for (const filename of files) {
      if (filename.startsWith(mediaFolder) && supportedImageRegex.test(filename)) {

        try {
          const fileData = await zip.file(filename).async('arraybuffer');
          const watermarkedBlob = await watermarkImage(fileData, {
            ...options,
            filename: filename,  // Pass original image filename
          });

          const watermarkedArrayBuffer = await watermarkedBlob.arrayBuffer();
          zip.file(filename, watermarkedArrayBuffer);
        } catch (err) {
          console.warn(`Skipping ${filename}: ${err.message}`);
        }
      }
    }
    
    const newDocxBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 8 } // Level 1–9 (1 = fast, 9 = best)
    });


    saveAs(newDocxBlob, 'watermarked.docx');
  } catch (e) {
    alert('Error processing images: ' + e.message);
  } finally {
    processButton.disabled = false;
    processButton.textContent = processButtonText;
  }
};


const copyrightYear = document.getElementById('copyright-year');
if (copyrightYear) copyrightYear.innerText = (new Date()).getFullYear();