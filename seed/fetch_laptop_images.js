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
            console.warn(`⚠️ Downloaded file too small: ${fileName} (${size} bytes)`);
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

// Curated verified official manufacturer product photos with clean/transparent backgrounds
const LAPTOP_IMAGES = [
  // Apple MacBooks
  {
    name: 'macbook-air-m4-13.png',
    url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mba13-spacegray-select-202402?wid=904&hei=840&fmt=png-alpha'
  },
  {
    name: 'macbook-air-m4-15.png',
    url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mba15-midnight-select-202402?wid=904&hei=840&fmt=png-alpha'
  },
  {
    name: 'macbook-pro-m4-14.png',
    url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-spaceblack-select-202410?wid=904&hei=840&fmt=png-alpha'
  },
  {
    name: 'macbook-pro-m4-pro.png',
    url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-silver-select-202410?wid=904&hei=840&fmt=png-alpha'
  },
  {
    name: 'macbook-pro-m4-max.png',
    url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp16-spaceblack-select-202410?wid=904&hei=840&fmt=png-alpha'
  },

  // Dell
  {
    name: 'dell-xps-13.png',
    url: 'https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/xps-notebooks/xps-13-9340/media-gallery/silver/touch/notebook-laptop-xps-13-9340-t-silver-gallery-1.psd?fmt=png-alpha&wid=800'
  },
  {
    name: 'dell-xps-15.png',
    url: 'https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/xps-notebooks/xps-15-9530/media-gallery/touch/notebook-xps-15-9530-t-silver-gallery-1.psd?fmt=png-alpha&wid=800'
  },
  {
    name: 'dell-inspiron-15.png',
    url: 'https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/inspiron-notebooks/15-3530-intel/media-gallery/black/notebook-inspiron-15-3530-black-gallery-1.psd?fmt=png-alpha&wid=800'
  },
  {
    name: 'dell-inspiron-14.png',
    url: 'https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/inspiron-notebooks/inspiron-14-5430-laptop/media-gallery/in-5430-sl-gallery-1.psd?fmt=png-alpha&wid=800'
  },
  {
    name: 'dell-g15.png',
    url: 'https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/g-series/g15-5530/media-gallery/gray/non-touch/4-zone-rgb-kb/notebook-laptop-g15-5530-gray-gallery-1.psd?fmt=png-alpha&wid=800'
  },

  // Lenovo
  {
    name: 'lenovo-ideapad-slim-5.png',
    url: 'https://p1-ofp.static.pub/medias/27733345736_IPS514IMH10LunaGrey_202511110446081775676080400.png'
  },
  {
    name: 'lenovo-yoga-7.png',
    url: 'https://psrefstuff.lenovo.com/syspool/Sys/Image/Yoga/Yoga_7_14IRL8/Compressedimage/Yoga_7_14IRL8_CT1_01.png'
  },
  {
    name: 'lenovo-thinkpad-e14.png',
    url: 'https://psrefstuff.lenovo.com/syspool/Sys/Image/ThinkPad/ThinkPad_E14/Compressedimage/ThinkPad_E14_CT1_01.png'
  },
  {
    name: 'lenovo-legion-5.png',
    url: 'https://p3-ofp.static.pub/ShareResource/optimized/pdp/legion/legion-5-series/len101g0050/hero-front-facing.png'
  },
  {
    name: 'lenovo-loq.png',
    url: 'https://p4-ofp.static.pub//fes/cms/2024/05/20/bck35fhess1td0jtxhbqx1a2s9ofzk318843.png'
  },

  // HP
  {
    name: 'hp-pavilion-15.png',
    url: 'https://www.hp.com/content/dam/sites/worldwide/personal-computers/consumer/laptops/pavilion/pavilion-15-laptop-pc-pdp-gallery-01.png'
  },
  {
    name: 'hp-pavilion-plus.png',
    url: 'https://www.hp.com/content/dam/sites/worldwide/personal-computers/consumer/laptops/pavilion-plus/pavilion-plus-14-gallery-01.png'
  },
  {
    name: 'hp-envy-x360.png',
    url: 'https://www.hp.com/content/dam/sites/worldwide/personal-computers/consumer/laptops/envy/envy-x360-15-gallery-01.png'
  },
  {
    name: 'hp-spectre-x360.png',
    url: 'https://www.hp.com/content/dam/sites/worldwide/personal-computers/consumer/laptops/spectre/spectre-x360-14-gallery-01.png'
  },
  {
    name: 'hp-victus.png',
    url: 'https://www.hp.com/content/dam/sites/worldwide/personal-computers/consumer/laptops/victus/victus-16-gallery-01.png'
  },
  {
    name: 'hp-omen.png',
    url: 'https://www.hp.com/content/dam/sites/worldwide/personal-computers/consumer/laptops/omen/omen-16-gallery-01.png'
  },

  // ASUS
  {
    name: 'asus-zenbook-14.png',
    url: 'https://dlcdnwebimgs.asus.com/gain/3DCE3182-0199-4786-8E34-4537E90BDE99/w800'
  },
  {
    name: 'asus-vivobook-15.png',
    url: 'https://dlcdnwebimgs.asus.com/gain/9BB281DE-68FA-466D-B076-2DCC4B9B4962/w800'
  },
  {
    name: 'asus-vivobook-s14.png',
    url: 'https://dlcdnwebimgs.asus.com/gain/8C4C87BF-585A-4A0B-9759-FDF60C446F04/w800'
  },
  {
    name: 'asus-rog-strix-g16.png',
    url: 'https://dlcdnwebimgs.asus.com/gain/3067C08D-7F18-4712-B67D-89405E6090DC/w800'
  },
  {
    name: 'asus-tuf-gaming-a15.png',
    url: 'https://dlcdnwebimgs.asus.com/gain/9B90D1A1-2C6A-4A2D-B8CA-CE583857B96F/w800'
  },

  // Acer & MSI
  {
    name: 'acer-aspire-7.png',
    url: 'https://static-ecapac.acer.com/media/catalog/product/a/s/aspire_7_a715-76g_01.png'
  },
  {
    name: 'acer-swift-go-14.png',
    url: 'https://static-ecapac.acer.com/media/catalog/product/s/w/swift_go_14_sfg14-72_01.png'
  },
  {
    name: 'acer-nitro-v15.png',
    url: 'https://static-ecapac.acer.com/media/catalog/product/n/i/nitro_v_15_anv15-51_01.png'
  },
  {
    name: 'acer-predator-helios-neo.png',
    url: 'https://static-ecapac.acer.com/media/catalog/product/p/r/predator_helios_neo_16_phn16-72_01.png'
  },
  {
    name: 'msi-thin-15.png',
    url: 'https://asset.msi.com/resize/image/global/product/product_170530739943fe06144cf6b8f399e5a1b3be373b52.png62405b38c58fe0f07fcef2367d8a9ba1/600.png'
  },
  {
    name: 'msi-katana-15.png',
    url: 'https://asset.msi.com/resize/image/global/product/product_1675760824bfa76f57876b5db79db591c28f980144.png62405b38c58fe0f07fcef2367d8a9ba1/600.png'
  }
];

async function run() {
  console.log(`Starting download for ${LAPTOP_IMAGES.length} laptop images...`);
  for (const item of LAPTOP_IMAGES) {
    await downloadFile(item.url, item.name);
  }
  console.log('Finished laptop image download pass.');
}

run();
