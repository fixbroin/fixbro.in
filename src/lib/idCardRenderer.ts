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
  const disclaimer = options.disclaimerText || 'This is a professional work identity card for individuals engaged in skilled service professions. Not issued by Government.';

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
  ctx.fillRect(0, 32, w, 76);

  // Header Title CENTERED: INDIAN [CATEGORY] ID CARD (No lion, no verified badge, no subtitle)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cardTitle, w / 2, 80);
  ctx.textAlign = 'start';

  // 4. PHOTO FRAME (Left Column) - Clean, Big, NO SIM CARD / NO BADGES
  const photoX = 50;
  const photoY = 145;
  const photoW = 240;
  const photoH = 300;

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
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(providerName.charAt(0), photoX + photoW / 2, photoY + photoH / 2 + 22);
      ctx.textAlign = 'start';
    }
  } else {
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(providerName.charAt(0), photoX + photoW / 2, photoY + photoH / 2 + 22);
    ctx.textAlign = 'start';
  }

  // 5. DETAILS (Right Column)
  const textX = 320;
  let textY = 175;

  // Name (Bigger)
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("NAME OF SERVICE PROFESSIONAL / नाम:", textX, textY);

  textY += 36;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 32px "Segoe UI", Roboto, sans-serif';
  const splitName = providerName.length > 25 ? `${providerName.substring(0, 24)}...` : providerName;
  ctx.fillText(splitName, textX, textY);

  // Indian Flag on the Right Side (Empty Space beside Name)
  drawIndianFlagCanvas(ctx, w - 170, 150, 120, 80);

  // Gender / लिंग & DOB
  textY += 38;
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
  const genderLabel = gender === 'MALE' ? 'MALE / पुरुष' : gender === 'FEMALE' ? 'FEMALE / महिला' : gender;
  const dobLabel = options.dob ? `   DOB: ${options.dob}` : '';
  ctx.fillText(`लिंग / GENDER:  ${genderLabel}${dobLabel}`, textX, textY);

  // Trade / व्यवसाय Badge (Bigger as requested)
  textY += 38;
  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.roundRect(textX, textY - 26, 420, 38, 6);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 19px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`TRADE / व्यवसाय:  ${categoryName}`, textX + 16, textY);

  // Skill Level / कौशल स्तर (Bigger as requested)
  textY += 44;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`SKILL LEVEL / कौशल स्तर:  ${skillLevel}`, textX, textY);

  // Issue & Valid Thru (Bigger as requested)
  textY += 38;
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`ISSUED: ${issueDateStr}`, textX, textY);
  ctx.fillStyle = '#059669';
  ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`VALID THRU: ${validThruStr}`, textX + 240, textY);

  // 6. RED BOXED DISCLAIMER (Generalized, no FixBro mention)
  let cleanDisclaimer = options.disclaimerText || 'This is a professional work identity card for individuals engaged in skilled service professions. Not issued by Government.';
  if (cleanDisclaimer.includes('FixBro') || cleanDisclaimer.includes('Fixbro') || cleanDisclaimer.includes('private platform')) {
    cleanDisclaimer = 'This is a professional work identity card for individuals engaged in skilled service professions. Not issued by Government.';
  }

  const boxX = textX;
  const boxY = textY + 14;
  const boxW = 640;
  const boxH = 56;

  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = '#FEF2F2';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#991B1B';
  ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
  wrapCanvasText(ctx, `NOTICE: ${cleanDisclaimer}`, boxX + 12, boxY + 20, boxW - 24, 18, 2);

  // 7. CARDHOLDER SIGNATURE (Below Notice)
  const sigY = boxY + boxH + 6;
  const titleCaseName = providerName
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const sigRightX = boxX + boxW - 10;
  ctx.textAlign = 'right';

  // Digital Signature in cursive script font
  ctx.fillStyle = '#1E3A8A';
  ctx.font = 'italic 26px "Brush Script MT", "Caveat", "Segoe Script", cursive, Georgia, serif';
  ctx.fillText(titleCaseName, sigRightX, sigY + 22);

  // Signature line
  const nameMetrics = ctx.measureText(titleCaseName);
  const lineW = Math.max(180, nameMetrics.width + 20);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(sigRightX - lineW, sigY + 28);
  ctx.lineTo(sigRightX, sigY + 28);
  ctx.stroke();

  // Signature label
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("हस्ताक्षर / Cardholder Signature", sigRightX, sigY + 44);
  ctx.textAlign = 'start';

  // 8. BOTTOM: UNIQUE ID NUMBER (Large bold font)
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, h - 85);
  ctx.lineTo(w - 50, h - 85);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 44px "Consolas", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(idNumber, w / 2, h - 42);
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
  ctx.fillRect(0, 0, w, 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 12, w, 8);
  ctx.fillStyle = '#138808';
  ctx.fillRect(0, 20, w, 12);

  // Top Header Background
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 32, w, 70);

  // Header Title CENTERED (No lions, no subtitle)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 30px "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cardTitle, w / 2, 76);
  ctx.textAlign = 'start';

  // LEFT COLUMN: Residential Address, Mobile, Email & Flag Below
  const addrX = 60;
  let addrY = 145;

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 22px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("पता / ADDRESS:", addrX, addrY);

  addrY += 30;
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';

  // Format multiline address neatly
  const words = address.split(' ');
  let curLine = '';
  for (const word of words) {
    const testLine = curLine ? `${curLine} ${word}` : word;
    if (ctx.measureText(testLine).width > 540) {
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

  // 1. Mobile Number below address
  const mobile = options.mobileNumber || '+91 73531 45565';
  addrY += 6;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`मोबाईल / MOBILE:  ${mobile}`, addrX, addrY);

  // 2. Email below mobile
  const email = options.email || 'provider@fixbro.in';
  addrY += 26;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`ईमेल / EMAIL:  ${email}`, addrX, addrY);

  // 3. Indian Flag below email (Authority text removed as requested)
  const flagY = addrY + 16;
  const flagW = 125;
  const flagH = 82;
  drawIndianFlagCanvas(ctx, addrX, flagY, flagW, flagH);

  // 4. Disclaimer text below flag (Not issued by government)
  const noticeY = flagY + flagH + 22;
  ctx.fillStyle = '#991B1B';
  ctx.font = 'bold 13.5px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("This ID is not issued by Government.", addrX, noticeY);
  ctx.fillStyle = '#DC2626';
  ctx.font = '12px "Segoe UI", Roboto, sans-serif';
  ctx.fillText("यह पहचान पत्र सरकार द्वारा जारी नहीं किया गया है।", addrX, noticeY + 18);

  // RIGHT COLUMN: Large QR Code
  const qrX = 660;
  const qrY = 135;
  const qrSize = 280;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(qrX, qrY, qrSize, qrSize, 12);
  ctx.fill();
  ctx.stroke();

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(verifyUrl)}`;
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
  ctx.font = 'bold 14px "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("SCAN WITH SMARTPHONE TO VERIFY", qrX + qrSize / 2, qrY + qrSize + 26);
  ctx.fillText("क्यूआर कोड स्कैन करके सत्यापन करें", qrX + qrSize / 2, qrY + qrSize + 46);
  ctx.textAlign = 'start';

  // BOTTOM: UNIQUE ID NUMBER (Clean, disclaimer below ID removed as requested)
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, h - 85);
  ctx.lineTo(w - 50, h - 85);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 44px "Consolas", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(idNumber, w / 2, h - 40);
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
