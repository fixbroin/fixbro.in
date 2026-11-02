import { jsPDF } from 'jspdf';

export interface IdCardRenderOptions {
  providerName: string;
  categoryName: string;
  skillLevelLabel?: string;
  gender?: string;
  dob?: string;
  idCardNumber: string;
  profilePhotoUrl?: string | null;
  residentialAddress?: string;
  mobileNumber?: string;
  email?: string;
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
 * Draw Indian Flag (Tiranga) with Ashoka Chakra on Canvas
 */
export const drawIndianFlagCanvas = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  ctx.save();
  const stripeH = h / 3;

  // Saffron
  ctx.fillStyle = '#FF9933';
  ctx.fillRect(x, y, w, stripeH);

  // White
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y + stripeH, w, stripeH);

  // Green
  ctx.fillStyle = '#138808';
  ctx.fillRect(x, y + stripeH * 2, w, stripeH);

  // Outer border for flag
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);

  // Ashoka Chakra in center
  const cx = x + w / 2;
  const cy = y + stripeH * 1.5;
  const radius = stripeH * 0.42;

  ctx.strokeStyle = '#000080';
  ctx.fillStyle = '#000080';
  ctx.lineWidth = Math.max(1, radius * 0.12);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.2, 0, 2 * Math.PI);
  ctx.fill();

  for (let i = 0; i < 24; i++) {
    const angle = (i * 2 * Math.PI) / 24;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
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
 * Clean multi-line text wrapping helper for Canvas
 */
export const wrapCanvasText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 3
) => {
  const words = text.split(' ');
  let line = '';
  let lineCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, y);
      line = words[n] + ' ';
      y += lineHeight;
      lineCount++;
      if (lineCount >= maxLines - 1) {
        ctx.fillText(words.slice(n).join(' '), x, y);
        return;
      }
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, y);
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
  const idNumber = options.idCardNumber || '1001';
  const issueDateStr = options.issueDateStr || '11/2026';
  const validThruStr = options.validThruStr || '11/2028';

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
  drawAshokaChakra(ctx, w / 2 + 100, h / 2 + 20, 150, 0.04);

  // 2. TOP BANNER: Indian Tricolor Band (Saffron, White, Green)
  ctx.fillStyle = '#FF9933';
  ctx.fillRect(0, 0, w, 10);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 10, w, 6);
  ctx.fillStyle = '#138808';
  ctx.fillRect(0, 16, w, 10);

  // 3. Header Background (Deep Blue/Navy)
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 26, w, 72);

  // Header Title CENTERED: INDIAN [CATEGORY] ID CARD
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cardTitle, w / 2, 73);
  ctx.textAlign = 'start';

  // 4. PHOTO FRAME (Left Column) - Fills height cleanly from y=106 to y=526 (420px tall)
  const photoX = 35;
  const photoY = 106;
  const photoW = 285;
  const photoH = 420;

  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
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
      ctx.font = 'bold 80px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(providerName.charAt(0), photoX + photoW / 2, photoY + photoH / 2 + 28);
      ctx.textAlign = 'start';
    }
  } else {
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(providerName.charAt(0), photoX + photoW / 2, photoY + photoH / 2 + 28);
    ctx.textAlign = 'start';
  }

  // 5. DETAILS (Right Column) - Expanded to utilize all available space
  const textX = 345;
  const rightBoundary = w - 35;
  const detailsWidth = rightBoundary - textX;

  // Indian Flag on the Right Side (beside name)
  const flagW = 128;
  const flagH = 84;
  drawIndianFlagCanvas(ctx, rightBoundary - flagW, 106, flagW, flagH);

  // Name Label
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("NAME OF SERVICE PROFESSIONAL / नाम:", textX, 128);

  // Name (Larger & Bolder)
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 36px "Segoe UI", Roboto, sans-serif';
  const maxNameWidth = detailsWidth - flagW - 15;
  let splitName = providerName;
  if (ctx.measureText(splitName).width > maxNameWidth) {
    while (splitName.length > 3 && ctx.measureText(`${splitName}...`).width > maxNameWidth) {
      splitName = splitName.slice(0, -1);
    }
    splitName = `${splitName}...`;
  }
  ctx.fillText(splitName, textX, 168);

  // Gender & DOB
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 22px "Segoe UI", Roboto, sans-serif';
  const genderLabel = gender === 'MALE' ? 'MALE / पुरुष' : gender === 'FEMALE' ? 'FEMALE / महिला' : gender;
  const dobLabel = options.dob ? `     DOB: ${options.dob}` : '';
  ctx.fillText(`लिंग / GENDER:  ${genderLabel}${dobLabel}`, textX, 212);

  // Trade / व्यवसाय Badge (Taller, wider, and bolder)
  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.roundRect(textX, 230, detailsWidth, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`TRADE / व्यवसाय:  ${categoryName}`, textX + 18, 263);

  // Skill Level / कौशल स्तर
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 23px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`SKILL LEVEL / कौशल स्तर:  ${skillLevel}`, textX, 314);

  // Issue & Valid Thru
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 21px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`ISSUED: ${issueDateStr}`, textX, 355);
  ctx.fillStyle = '#059669';
  ctx.font = 'bold 21px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`VALID THRU: ${validThruStr}`, textX + 270, 355);

  // 6. RED BOXED DISCLAIMER (Generalized, no FixBro mention)
  let cleanDisclaimer = options.disclaimerText || 'This is a professional work identity card for individuals engaged in skilled service professions. Not issued by Government.';
  if (cleanDisclaimer.includes('FixBro') || cleanDisclaimer.includes('Fixbro') || cleanDisclaimer.includes('private platform')) {
    cleanDisclaimer = 'This is a professional work identity card for individuals engaged in skilled service professions. Not issued by Government.';
  }

  const boxX = textX;
  const boxY = 376;
  const boxW = detailsWidth;
  const boxH = 64;

  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = '#FEF2F2';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#991B1B';
  ctx.font = 'bold 13.5px "Segoe UI", Roboto, sans-serif';
  wrapCanvasText(ctx, `NOTICE: ${cleanDisclaimer}`, boxX + 12, boxY + 22, boxW - 24, 20, 2);

  // 7. CARDHOLDER SIGNATURE & SECURITY NOTE (Below Notice)
  const sigY = 448;
  const titleCaseName = providerName
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Left side under notice: Partner verification assurance
  ctx.fillStyle = '#0284C7';
  ctx.font = 'bold 14px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("Certified Skilled Partner", boxX, sigY + 22);
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("Verified Work Credential • Non-Transferable", boxX, sigY + 44);

  // Right side: Signature in cursive script font
  const sigRightX = boxX + boxW - 8;
  ctx.textAlign = 'right';

  ctx.fillStyle = '#1E3A8A';
  ctx.font = 'italic 32px "Brush Script MT", "Caveat", "Segoe Script", cursive, Georgia, serif';
  ctx.fillText(titleCaseName, sigRightX, sigY + 22);

  // Signature line
  const nameMetrics = ctx.measureText(titleCaseName);
  const lineW = Math.max(200, nameMetrics.width + 20);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sigRightX - lineW, sigY + 30);
  ctx.lineTo(sigRightX, sigY + 30);
  ctx.stroke();

  // Signature label
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 12.5px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("हस्ताक्षर / Cardholder Signature", sigRightX, sigY + 48);
  ctx.textAlign = 'start';

  // 8. BOTTOM: UNIQUE ID NUMBER (Clean divider and large monospace number)
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(35, 538);
  ctx.lineTo(w - 35, 538);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 56px "Consolas", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(idNumber, w / 2, 592);
  ctx.textAlign = 'start';

  // 9. Bottom Tricolor Stripe
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
  const cardTitle = `INDIAN ${categoryName} WORKER ID CARD`;
  const address = options.residentialAddress || 'Address on record with FixBro';
  const idNumber = options.idCardNumber || '1001';
  const verifyUrl = options.verifyUrl || `https://fixbro.in/verify/provider/${idNumber.replace(/\s+/g, '')}`;

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  drawGuillochePattern(ctx, w, h);
  drawAshokaChakra(ctx, w / 2, h / 2, 160, 0.04);

  // Top Tricolor Stripe
  ctx.fillStyle = '#FF9933';
  ctx.fillRect(0, 0, w, 10);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 10, w, 6);
  ctx.fillStyle = '#138808';
  ctx.fillRect(0, 16, w, 10);

  // Top Header Background
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 26, w, 72);

  // Header Title CENTERED
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cardTitle, w / 2, 73);
  ctx.textAlign = 'start';

  // RIGHT COLUMN: Large Verification QR Code (Positioned first to define left column width)
  const qrSize = 320;
  const qrX = w - 35 - qrSize; // 657
  const qrY = 110;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(qrX, qrY, qrSize, qrSize, 12);
  ctx.fill();
  ctx.stroke();

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(verifyUrl)}`;
  try {
    const qrImg = await loadCanvasImage(qrApiUrl);
    ctx.drawImage(qrImg, qrX + 12, qrY + 12, qrSize - 24, qrSize - 24);
  } catch {
    ctx.fillStyle = '#111827';
    ctx.fillRect(qrX + 35, qrY + 35, 60, 60);
    ctx.fillRect(qrX + qrSize - 95, qrY + 35, 60, 60);
    ctx.fillRect(qrX + 35, qrY + qrSize - 95, 60, 60);
    ctx.font = 'bold 18px monospace';
    ctx.fillText("SCAN TO VERIFY", qrX + 65, qrY + qrSize / 2);
  }

  // QR Instructions below QR box
  const qrCenterX = qrX + qrSize / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("SCAN WITH SMARTPHONE TO VERIFY", qrCenterX, qrY + qrSize + 28);
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("क्यूआर कोड स्कैन करके सत्यापन करें", qrCenterX, qrY + qrSize + 50);
  ctx.fillStyle = '#0284C7';
  ctx.font = 'bold 13px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("Official Digital Verification Portal", qrCenterX, qrY + qrSize + 72);
  ctx.textAlign = 'start';

  // LEFT COLUMN: Residential Address, Mobile, Email & Flag
  const addrX = 35;
  const maxAddrWidth = qrX - addrX - 25; // ~597px
  let curY = 136;

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 25px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("पता / ADDRESS:", addrX, curY);

  curY += 32;
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 21px "Segoe UI", Roboto, sans-serif';

  // Format multiline address neatly (up to 3 lines)
  const words = address.split(' ');
  let curLine = '';
  let lineCount = 0;
  for (const word of words) {
    const testLine = curLine ? `${curLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxAddrWidth) {
      ctx.fillText(curLine, addrX, curY);
      curY += 28;
      lineCount++;
      curLine = word;
      if (lineCount >= 3) {
        break;
      }
    } else {
      curLine = testLine;
    }
  }
  if (curLine && lineCount < 3) {
    ctx.fillText(curLine, addrX, curY);
    curY += 28;
  }

  // 1. Mobile Number below address
  const mobile = options.mobileNumber || '+91 73531 45565';
  curY += 10;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 22px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`मोबाईल / MOBILE:  ${mobile}`, addrX, curY);

  // 2. Email below mobile
  const email = options.email || 'provider@fixbro.in';
  curY += 30;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 22px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`ईमेल / EMAIL:  ${email}`, addrX, curY);

  // 3. Indian Flag & Legal Disclaimer (Positioned neatly from y=415 to 515)
  const flagY = Math.max(curY + 14, 415);
  const flagW = 148;
  const flagH = 98;
  drawIndianFlagCanvas(ctx, addrX, flagY, flagW, flagH);

  // 4. Disclaimer text beside flag
  const discX = addrX + flagW + 18;
  ctx.fillStyle = '#991B1B';
  ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("This ID is not issued by Government.", discX, flagY + 28);
  ctx.fillStyle = '#DC2626';
  ctx.font = 'bold 14.5px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("यह पहचान पत्र सरकार द्वारा जारी नहीं किया गया है।", discX, flagY + 52);
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13.5px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("Private Skilled Professional Work ID Card", discX, flagY + 74);
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("FixBro Platform Partner Identification", discX, flagY + 92);

  // BOTTOM: UNIQUE ID NUMBER (Clean divider and large monospace number)
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(35, 538);
  ctx.lineTo(w - 35, 538);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 56px "Consolas", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(idNumber, w / 2, 592);
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
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [85.6, 53.98],
  });

  pdf.addImage(frontDataUrl, 'PNG', 0, 0, 85.6, 53.98);
  pdf.addPage([85.6, 53.98], 'landscape');
  pdf.addImage(backDataUrl, 'PNG', 0, 0, 85.6, 53.98);

  pdf.save(fileName);
};
