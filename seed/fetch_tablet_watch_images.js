const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', '..', 'Frontend', 'public', 'products');
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

function downloadFile(url, fileName) {
  return new Promise((resolve) => {
    const dest = path.join(targetDir, fileName);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
      console.log(`⚡ Already exists: ${fileName} (${fs.statSync(dest).size} bytes)`);
      return resolve(true);
    }

    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, fileName).then(resolve);
      }
      if (res.statusCode === 200) {
        const fileStream = fs.createWriteStream(dest);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          const size = fs.statSync(dest).size;
          if (size > 1000) {
            console.log(`✅ Downloaded: ${fileName} (${size} bytes)`);
            resolve(true);
          } else {
            console.warn(`⚠️ Too small: ${fileName} (${size} bytes)`);
            resolve(false);
          }
        });
      } else {
        console.warn(`❌ Failed ${res.statusCode} for ${fileName} (${url})`);
        resolve(false);
      }
    });

    req.on('error', (err) => {
      console.error(`❌ Request error for ${fileName}:`, err.message);
      resolve(false);
    });
    req.setTimeout(15000, () => {
      req.destroy();
      console.warn(`⏳ Timeout for ${fileName}`);
      resolve(false);
    });
  });
}

// Curated verified official product photo CDN URLs
const DEVICE_IMAGES = [
  // Samsung Tablets
  {
    name: 'galaxy-tab-s9-ultra.png',
    url: 'https://images.samsung.com/is/image/samsung/p6pim/in/sm-x910nzaainu/gallery/in-galaxy-tab-s9-ultra-wifi-x910-sm-x910nzaainu-537841578?$730_584_PNG$'
  },
  {
    name: 'galaxy-tab-s10-plus.png',
    url: 'https://images.samsung.com/is/image/samsung/p6pim/in/sm-x820nzaainu/gallery/in-galaxy-tab-s10-plus-wifi-x820-sm-x820nzaainu-thumb-543781254?$730_584_PNG$'
  },
  // Xiaomi Tablet
  {
    name: 'xiaomi-pad-6.png',
    url: 'https://i02.appmifile.com/181_operator_in/23/05/2023/102c77d4da075c74fbba8ca05d04523c.png'
  },
  // Lenovo Tablet
  {
    name: 'lenovo-tab-p12.png',
    url: 'https://p3-ofp.static.pub/fes/cms/2023/07/20/y798c8868w8g9d87v5h94u9l673y4l906232.png'
  },
  // Samsung Watches
  {
    name: 'galaxy-watch-7.png',
    url: 'https://images.samsung.com/is/image/samsung/p6pim/in/2407/gallery/in-galaxy-watch7-l310-sm-l310nzaainu-thumb-542385153?$730_584_PNG$'
  },
  {
    name: 'galaxy-watch-ultra.png',
    url: 'https://images.samsung.com/is/image/samsung/p6pim/in/2407/gallery/in-galaxy-watch-ultra-l705-sm-l705fztaainu-thumb-542384666?$730_584_PNG$'
  },
  // Google Pixel Watch 3
  {
    name: 'pixel-watch-3.png',
    url: 'https://lh3.googleusercontent.com/yv9R7H_P2hCGBZf_1Y5l0p8z_nL5lW_uQpA6jB2X9-g-F-R4kF5kZ4W-u9u5GkM'
  },
  // Garmin Forerunner 265
  {
    name: 'garmin-forerunner-265.png',
    url: 'https://res.garmin.com/en/products/010-02810-00/v/cf-lg.png'
  },
  // Amazfit Balance
  {
    name: 'amazfit-balance.png',
    url: 'https://cdn.shopify.com/s/files/1/0257/8989/0616/files/amazfit-balance-midnight.png?v=1693551520'
  },
  // Noise ColorFit Pro 5
  {
    name: 'noise-colorfit-pro-5.png',
    url: 'https://cdn.shopify.com/s/files/1/0997/6284/files/Colorfit_Pro_5_Max_Elite_Edition_1.png?v=1704285149'
  }
];

async function main() {
  console.log(`Starting download of ${DEVICE_IMAGES.length} device images...`);
  for (const item of DEVICE_IMAGES) {
    await downloadFile(item.url, item.name);
  }
  console.log('Finished downloading device images!');
}

main().catch(console.error);
