import { jsPDF } from 'jspdf';

export interface IdCardRenderOptions {
  providerName: string;
  categoryName: string;
  skillLevelLabel?: string;
  gender?: string;
  idCardNumber: string;
  profilePhotoUrl?: string | null;
  residentialAddress?: string;
  helplinePhone?: string;
  signatoryName?: string;
  issueDateStr?: string;
  validThruStr?: string;
  disclaimerText?: string;
  verifyUrl?: string;
}

/**
 * Load an image safely with CORS handling
 */
export const loadCanvasImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

/**
 * Draw 24-spoke Ashoka Chakra
 */
export const drawAshokaChakra = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  alpha: number = 0.85
) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#000080';
  ctx.fillStyle = '#000080';
  ctx.lineWidth = Math.max(1, radius * 0.08);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.18, 0, 2 * Math.PI);
  ctx.fill();

  for (let i = 0; i < 24; i++) {
    const angle = (i * 2 * Math.PI) / 24;
    const x2 = cx + radius * Math.cos(angle);
    const y2 = cy + radius * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * Draw Guilloche anti-counterfeit security patterns
 */
export const drawGuillochePattern = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => {
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.strokeStyle = '#003366';
  ctx.lineWidth = 1;
  for (let i = 30; i < width - 30; i += 28) {
    ctx.beginPath();
    for (let y = 0; y < height; y += 8) {
      const x = i + Math.sin((y + i) * 0.05) * 14;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * Draw the Ashoka Lion Capital (Three Lions) emblem on Canvas
 */
export const drawAshokaLion = async (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  try {
    const lionImg = await loadCanvasImage('/images/ashoka-emblem.svg');
    ctx.drawImage(lionImg, x, y, w, h);
  } catch {
    // Fallback vector representation if SVG load fails
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.35, w * 0.35, 0, 2 * Math.PI);
    ctx.fill();
    drawAshokaChakra(ctx, x + w / 2, y + h * 0.65, w * 0.25, 0.9);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("सत्यमेव जयते", x + w / 2, y + h - 2);
    ctx.restore();
  }
};

/**
 * Render 300 DPI Front Card Canvas (Standard CR80: 1012 x 638 px)
 */
export const renderFrontCardCanvas = async (
  options: IdCardRenderOptions,
  existingCanvas?: HTMLCanvasElement | null
): Promise<string> => {
  const canvas = existingCanvas || document.createElement('canvas');
  canvas.width = 1012;
  canvas.height = 638;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Could not get 2D context");

  const w = 1012;
  const h = 638;

  const providerName = (options.providerName || 'AUTHORIZED PARTNER').toUpperCase();
  const categoryRaw = options.categoryName || 'General';
  const categoryName = categoryRaw.toUpperCase();
  const cardTitle = `INDIAN ${categoryName} ID CARD`;
  const gender = (options.gender || 'Male').toUpperCase();
  const skillLevel = (options.skillLevelLabel || 'Skilled Professional').toUpperCase();
  const idNumber = options.idCardNumber || '3617 0760 1001';
  const issueDateStr = options.issueDateStr || '11/2026';
  const validThruStr = options.validThruStr || '11/2028';
  const disclaimer = options.disclaimerText || 'This ID card is issued by FixBro Private Platform for verified partner identification. Not a Government of India document.';

  // 1. Background Base
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#FFFFFF');
  bgGrad.addColorStop(0.5, '#F8FAFC');
  bgGrad.addColorStop(1, '#F1F5F9');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Security Pattern & Background Ashoka Chakra Watermark
  drawGuillochePattern(ctx, w, h);
  drawAshokaChakra(ctx, w / 2 + 100, h / 2 + 20, 140, 0.04);

  // 2. TOP BANNER: Indian Tricolor Band (Saffron, White, Green)
  ctx.fillStyle = '#FF9933';
  ctx.fillRect(0, 0, w, 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 12, w, 8);
  ctx.fillStyle = '#138808';
  ctx.fillRect(0, 20, w, 12);

  // 3. Header Background (Deep Blue/Navy)
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 32, w, 90);

  // Ashoka Lion Emblem (Three Lions)
  await drawAshokaLion(ctx, 42, 38, 54, 76);

  // Header Title: INDIAN [CATEGORY] ID CARD
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 27px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(cardTitle, 114, 72);

  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 14px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("VERIFIED SERVICE PROFESSIONAL  •  सेवा पेशेवर पहचान पत्र", 114, 100);

  // FixBro Verified Pill on Top Right
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.roundRect(w - 200, 56, 160, 40, 8);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("✓ VERIFIED", w - 120, 81);
  ctx.textAlign = 'start';

  // 4. PHOTO FRAME (Left Column) - Made Bigger as requested!
  const photoX = 50;
  const photoY = 145;
  const photoW = 230;
  const photoH = 280;

  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.roundRect(photoX, photoY, photoW, photoH, 10);
  ctx.fill();
  ctx.stroke();

  if (options.profilePhotoUrl) {
    try {
      const pImg = await loadCanvasImage(options.profilePhotoUrl);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(photoX, photoY, photoW, photoH, 10);
      ctx.clip();
      ctx.drawImage(pImg, photoX, photoY, photoW, photoH);
      ctx.restore();
    } catch {
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 60px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(providerName.charAt(0), photoX + photoW / 2, photoY + photoH / 2 + 20);
      ctx.textAlign = 'start';
    }
  } else {
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(providerName.charAt(0), photoX + photoW / 2, photoY + photoH / 2 + 20);
    ctx.textAlign = 'start';
  }

  // Verification Badge below photo (NO SIM CARD!)
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(photoX, photoY + photoH + 16, photoW, 36, 6);
  ctx.fill();

  ctx.fillStyle = '#34D399';
  ctx.font = 'bold 13px "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("✓ KYC & POLICE VERIFIED", photoX + photoW / 2, photoY + photoH + 39);
  ctx.textAlign = 'start';

  // 5. DETAILS (Right Column)
  const textX = 310;
  let textY = 175;

  // Name (Bigger as requested)
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 14px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("NAME OF SERVICE PROFESSIONAL / नाम:", textX, textY);

  textY += 34;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 30px "Segoe UI", Roboto, sans-serif';
  const splitName = providerName.length > 25 ? `${providerName.substring(0, 24)}...` : providerName;
  ctx.fillText(splitName, textX, textY);

  // Gender / लिंग
  textY += 36;
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`लिंग / GENDER:  ${gender === 'MALE' ? 'MALE / पुरुष' : gender === 'FEMALE' ? 'FEMALE / महिला' : gender}`, textX, textY);

  // Trade / व्यवसाय Badge
  textY += 34;
  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.roundRect(textX, textY - 24, 380, 34, 6);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`TRADE: ${categoryName}`, textX + 16, textY);

  // Skill Level / कौशल स्तर
  textY += 40;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`SKILL LEVEL / कौशल स्तर:  ${skillLevel}`, textX, textY);

  // Issue & Valid Thru
  textY += 34;
  ctx.fillStyle = '#64748B';
  ctx.font = '16px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`ISSUED: ${issueDateStr}`, textX, textY);
  ctx.fillStyle = '#059669';
  ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`VALID THRU: ${validThruStr}`, textX + 220, textY);

  // 6. RED/SLATE BOXED DISCLAIMER (Aadhaar Style)
  const boxX = textX;
  const boxY = textY + 20;
  const boxW = 650;
  const boxH = 58;

  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = '#FEF2F2';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#991B1B';
  ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("NOTICE: " + disclaimer, boxX + 12, boxY + 24);
  ctx.font = '11.5px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("यह पहचान पत्र निजी मंच द्वारा सत्यापित साथी पहचान हेतु जारी किया गया है, यह सरकारी दस्तावेज नहीं है।", boxX + 12, boxY + 44);

  // 7. BOTTOM: UNIQUE ID NUMBER (Large bold font like Aadhaar 3617 0760 6355)
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, h - 90);
  ctx.lineTo(w - 50, h - 90);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 40px "Consolas", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(idNumber, w / 2, h - 45);
  ctx.textAlign = 'start';

  // 8. Bottom Tricolor Stripe
  ctx.fillStyle = '#FF9933';
  ctx.fillRect(0, h - 24, w, 8);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, h - 16, w, 8);
  ctx.fillStyle = '#138808';
  ctx.fillRect(0, h - 8, w, 8);

  // Card Outer Border
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, w, h);
  ctx.restore();

  return canvas.toDataURL('image/png');
};

/**
 * Render 300 DPI Back Card Canvas (Standard CR80: 1012 x 638 px)
 */
export const renderBackCardCanvas = async (
  options: IdCardRenderOptions,
  existingCanvas?: HTMLCanvasElement | null
): Promise<string> => {
  const canvas = existingCanvas || document.createElement('canvas');
  canvas.width = 1012;
  canvas.height = 638;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Could not get 2D context");

  const w = 1012;
  const h = 638;

  const categoryName = (options.categoryName || 'General').toUpperCase();
  const cardTitle = `INDIAN ${categoryName} ID CARD`;
  const address = options.residentialAddress || 'Address not registered with FixBro';
  const idNumber = options.idCardNumber || '3617 0760 1001';
  const helpline = options.helplinePhone || '+91 8000 123 456';
  const signatory = options.signatoryName || 'Authorized Signatory - FixBro';
  const verifyUrl = options.verifyUrl || `https://fixbro.in/verify/provider/${idNumber.replace(/\s+/g, '')}`;

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  drawGuillochePattern(ctx, w, h);
  drawAshokaChakra(ctx, w / 2, h / 2, 160, 0.04);

  // Top Tricolor Stripe
  ctx.fillStyle = '#FF9933';
  ctx.fillRect(0, 0, w, 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 12, w, 8);
  ctx.fillStyle = '#138808';
  ctx.fillRect(0, 20, w, 12);

  // Top Header Background
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 32, w, 70);

  // Ashoka Lion Emblem
  await drawAshokaLion(ctx, 42, 38, 44, 58);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(cardTitle, 104, 66);

  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 13px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("VERIFICATION & REGISTRATION DETAILS  •  सत्यापन एवं संपर्क विवरण", 104, 88);

  // LEFT COLUMN: Residential Address & Contact
  const addrX = 55;
  let addrY = 145;

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("पता / ADDRESS:", addrX, addrY);

  addrY += 28;
  ctx.fillStyle = '#334155';
  ctx.font = '17px "Segoe UI", Roboto, sans-serif';

  // Format multiline address neatly
  const words = address.split(' ');
  let curLine = '';
  for (const word of words) {
    const testLine = curLine ? `${curLine} ${word}` : word;
    if (ctx.measureText(testLine).width > 560) {
      ctx.fillText(curLine, addrX, addrY);
      addrY += 28;
      curLine = word;
    } else {
      curLine = testLine;
    }
  }
  if (curLine) {
    ctx.fillText(curLine, addrX, addrY);
    addrY += 28;
  }

  // Customer Support & Helpline
  addrY = Math.max(addrY + 10, 280);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("CUSTOMER SUPPORT / ग्राहक सहायता:", addrX, addrY);

  addrY += 24;
  ctx.fillStyle = '#0284C7';
  ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`📞 ${helpline}   |   🌐 www.fixbro.in`, addrX, addrY);

  // Digital Signatory
  addrY += 40;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(addrX, addrY);
  ctx.lineTo(addrX + 260, addrY);
  ctx.stroke();

  ctx.fillStyle = '#1E3A8A';
  ctx.font = 'italic bold 22px "Brush Script MT", cursive, Georgia, serif';
  ctx.fillText("FixBro Verification Authority", addrX + 15, addrY - 8);

  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(signatory, addrX + 15, addrY + 18);

  // RIGHT COLUMN: Large QR Code (Aadhaar Style)
  const qrX = 680;
  const qrY = 125;
  const qrSize = 270;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(qrX, qrY, qrSize, qrSize, 12);
  ctx.fill();
  ctx.stroke();

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(verifyUrl)}`;
  try {
    const qrImg = await loadCanvasImage(qrApiUrl);
    ctx.drawImage(qrImg, qrX + 10, qrY + 10, qrSize - 20, qrSize - 20);
  } catch {
    ctx.fillStyle = '#111827';
    ctx.fillRect(qrX + 35, qrY + 35, 50, 50);
    ctx.fillRect(qrX + qrSize - 85, qrY + 35, 50, 50);
    ctx.fillRect(qrX + 35, qrY + qrSize - 85, 50, 50);
    ctx.font = 'bold 16px monospace';
    ctx.fillText("SCAN TO VERIFY", qrX + 60, qrY + qrSize / 2);
  }

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("SCAN WITH SMARTPHONE TO VERIFY", qrX + qrSize / 2, qrY + qrSize + 24);
  ctx.fillText("क्यूआर कोड स्कैन करके सत्यापन करें", qrX + qrSize / 2, qrY + qrSize + 42);
  ctx.textAlign = 'start';

  // BOTTOM: UNIQUE ID NUMBER
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, h - 90);
  ctx.lineTo(w - 50, h - 90);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 38px "Consolas", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(idNumber, w / 2, h - 50);

  // Legal Notice
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("This ID card is issued by a private platform (FixBro) for partner verification, not issued by government.", w / 2, h - 30);
  ctx.textAlign = 'start';

  // Bottom Tricolor Stripe
  ctx.fillStyle = '#FF9933';
  ctx.fillRect(0, h - 24, w, 8);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, h - 16, w, 8);
  ctx.fillStyle = '#138808';
  ctx.fillRect(0, h - 8, w, 8);

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, w, h);
  ctx.restore();

  return canvas.toDataURL('image/png');
};

/**
 * Generate standard CR80 PVC Plastic Card 2-page PDF
 */
export const generatePvcPdf = (
  frontDataUrl: string,
  backDataUrl: string,
  fileName: string = 'FixBro_PVC_ID_Card.pdf'
) => {
  // CR80 Plastic Card Dimensions: 85.6mm x 53.98mm
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [85.6, 53.98],
  });

  // Page 1: Front
  pdf.addImage(frontDataUrl, 'PNG', 0, 0, 85.6, 53.98);

  // Page 2: Back
  pdf.addPage([85.6, 53.98], 'landscape');
  pdf.addImage(backDataUrl, 'PNG', 0, 0, 85.6, 53.98);

  pdf.save(fileName);
};
