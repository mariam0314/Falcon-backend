const fs = require('fs');
const path = require('path');
const pdfDevices = require('./pdf_device_list');
const masterData = require('./masterCatalogueData');

function toModelSlug(brand, modelName) {
  let clean = modelName.trim();
  const bLower = brand.toLowerCase();
  clean = clean.replace(new RegExp(`^${brand}\\s+`, 'i'), '');
  const slug = `${bLower}-${clean}`
    .toLowerCase()
    .replace(/\+/g, '-plus')
    .replace(/&/g, '-and-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}.webp`;
}

function cleanSlug(brand, title) {
  let clean = title.trim();
  const bLower = brand.toLowerCase();
  clean = clean.replace(new RegExp(`^${brand}\\s+`, 'i'), '');
  const slug = `${bLower}-${clean}`
    .toLowerCase()
    .replace(/\+/g, '-plus')
    .replace(/&/g, '-and-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}.webp`;
}

// Brand logos mapping
const BRAND_LOGOS = {
  Apple: '/images/brands/Apple.png',
  Google: '/images/brands/Google.png',
  Motorola: '/images/brands/Motorola.png',
  Nokia: '/images/brands/Nokia.png',
  Nothing: '/images/brands/Nothing.webp',
  OnePlus: '/images/brands/OnePlus.png',
  Oppo: '/images/brands/Oppo.png',
  Poco: '/images/brands/Poco.png',
  Realme: '/images/brands/Realme.png',
  Samsung: '/images/brands/Samsung.png',
  Vivo: '/images/brands/Vivo.png',
  Xiaomi: '/images/brands/Xiaomi.png',
  Sony: '/images/brands/Sony.png',
};

function generateFullCatalog() {
  const catalogDocs = [];

  // 1. Mobile Category — All 1,065 devices from PDF
  let totalMobileModels = 0;
  for (const [brand, models] of Object.entries(pdfDevices)) {
    const brandLower = brand.toLowerCase();
    const brandModels = [];

    for (const mName of models) {
      const slug = toModelSlug(brand, mName);
      const imgPath = `/images/products/smartphones/${brandLower}/${slug}`;

      // Generate realistic variants
      const lowerM = mName.toLowerCase();
      let variants = [];
      if (lowerM.includes('ultra') || lowerM.includes('pro max') || lowerM.includes('fold')) {
        variants = [
          { specs: new Map([['ram', '12 GB'], ['storage', '256 GB']]), basePrice: 42000 },
          { specs: new Map([['ram', '16 GB'], ['storage', '512 GB']]), basePrice: 48000 },
          { specs: new Map([['ram', '16 GB'], ['storage', '1 TB']]), basePrice: 55000 },
        ];
      } else if (lowerM.includes('pro') || lowerM.includes('plus') || lowerM.includes('+')) {
        variants = [
          { specs: new Map([['ram', '8 GB'], ['storage', '128 GB']]), basePrice: 24000 },
          { specs: new Map([['ram', '8 GB'], ['storage', '256 GB']]), basePrice: 28000 },
          { specs: new Map([['ram', '12 GB'], ['storage', '512 GB']]), basePrice: 34000 },
        ];
      } else {
        variants = [
          { specs: new Map([['ram', '6 GB'], ['storage', '128 GB']]), basePrice: 12000 },
          { specs: new Map([['ram', '8 GB'], ['storage', '128 GB']]), basePrice: 15000 },
          { specs: new Map([['ram', '8 GB'], ['storage', '256 GB']]), basePrice: 18000 },
        ];
      }

      brandModels.push({
        name: mName,
        image: imgPath,
        variants,
        soldCount: Math.floor(Math.random() * 45) + 15
      });
      totalMobileModels++;
    }

    catalogDocs.push({
      brand,
      category: 'mobile',
      logo: BRAND_LOGOS[brand] || null,
      models: brandModels
    });
  }

  // 2. Non-Mobile Categories (laptop, tablet, smartwatch) from masterData
  const nonMobileProds = masterData.filter(p => p.category !== 'mobile');
  const nonMobileGroups = {};

  for (const prod of nonMobileProds) {
    const key = `${prod.brand}_${prod.category}`;
    if (!nonMobileGroups[key]) {
      nonMobileGroups[key] = {
        brand: prod.brand,
        category: prod.category,
        logo: BRAND_LOGOS[prod.brand] || null,
        models: []
      };
    }

    const catFolder = prod.category === 'laptop' ? 'laptops' : prod.category === 'tablet' ? 'tablets' : 'smartwatches';
    const slug = cleanSlug(prod.brand, prod.title);
    const imgPath = prod.images?.[0] || `/images/products/${catFolder}/${slug}`;

    const specsMap = new Map();
    if (prod.specs?.performance?.ram) specsMap.set('ram', prod.specs.performance.ram);
    if (prod.storage) specsMap.set('storage', prod.storage);
    if (prod.specs?.processor) specsMap.set('processor', prod.specs.processor);
    if (prod.specs?.display?.sizeInches) specsMap.set('screenSize', `${prod.specs.display.sizeInches}"`);

    const exists = nonMobileGroups[key].models.some(m => m.name === prod.title);
    if (!exists) {
      nonMobileGroups[key].models.push({
        name: prod.title,
        image: imgPath,
        variants: [
          {
            specs: specsMap,
            basePrice: Math.round(prod.price * 0.72)
          }
        ],
        soldCount: Math.floor(Math.random() * 35) + 12
      });
    }
  }

  for (const group of Object.values(nonMobileGroups)) {
    catalogDocs.push(group);
  }

  return catalogDocs;
}

module.exports = generateFullCatalog;
