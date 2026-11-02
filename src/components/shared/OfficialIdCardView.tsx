"use client";

import React from 'react';
import type { IdCardRenderOptions } from "@/lib/idCardRenderer";

interface OfficialIdCardViewProps {
  data: IdCardRenderOptions;
  activeSide: 'front' | 'back';
}

export default function OfficialIdCardView({ data, activeSide }: OfficialIdCardViewProps) {
  const providerName = (data.providerName || 'AUTHORIZED PARTNER').toUpperCase();
  const titleCaseName = (data.providerName || 'Authorized Partner')
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const categoryName = (data.categoryName || 'General').toUpperCase();
  const cardTitle = `INDIAN ${categoryName} ID CARD`;
  const gender = (data.gender || 'Male').toUpperCase();
  const skillLevel = (data.skillLevelLabel || 'Skilled Professional').toUpperCase();
  const idNumber = data.idCardNumber || '1001';
  const issueDateStr = data.issueDateStr || '11/2026';
  const validThruStr = data.validThruStr || '11/2028';
  const address = data.residentialAddress || 'Address on record';
  const mobile = data.mobileNumber || '+91 73531 45565';
  const email = data.email || 'provider@fixbro.in';

  let rawDisclaimer = data.disclaimerText || 'This is a professional work identity card for individuals engaged in skilled service professions. Not issued by Government.';
  if (rawDisclaimer.includes('FixBro') || rawDisclaimer.includes('Fixbro') || rawDisclaimer.includes('private platform')) {
    rawDisclaimer = 'This is a professional work identity card for individuals engaged in skilled service professions. Not issued by Government.';
  }
  const disclaimer = rawDisclaimer;
  const verifyUrl = data.verifyUrl || `https://fixbro.in/verify/provider/${idNumber.replace(/\s+/g, '')}`;

  return (
    <div className="w-full max-w-[506px] aspect-[85.6/53.98] rounded-2xl shadow-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 overflow-hidden relative select-none transition-all duration-300">
      {activeSide === 'front' ? (
        // FRONT CARD PREVIEW (CR80 Standard)
        <div className="h-full w-full flex flex-col justify-between p-0 relative bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
          {/* Top Indian Tricolor Band */}
          <div className="w-full shrink-0">
            <div className="h-1 bg-[#FF9933] w-full" />
            <div className="h-0.5 bg-white w-full" />
            <div className="h-1 bg-[#138808] w-full" />
            
            {/* Header Navy Banner: Centered Title, No Lions, No Badges, No Subtitle */}
            <div className="bg-[#0F172A] text-white px-3 py-2 flex items-center justify-center">
              <div className="text-[14px] font-black tracking-wider text-white uppercase text-center">
                {cardTitle}
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="px-3.5 py-1.5 flex gap-3 flex-grow items-center overflow-hidden">
            {/* Left Photo Column (Big, Clean, NO SIM CARD, NO BADGES) */}
            <div className="flex flex-col items-center shrink-0 w-24">
              <div className="w-24 h-32 rounded-lg overflow-hidden border-2 border-slate-500 bg-slate-200 flex items-center justify-center relative shadow-sm">
                {data.profilePhotoUrl ? (
                  <img src={data.profilePhotoUrl} alt={providerName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-slate-600">{providerName.charAt(0)}</span>
                )}
              </div>
            </div>

            {/* Right Information Column */}
            <div className="flex flex-col justify-center space-y-1 overflow-hidden flex-grow text-slate-900">
              {/* Row with Name & Indian Flag on the Right */}
              <div className="flex items-start justify-between gap-2">
                <div className="overflow-hidden">
                  <div className="text-[7.5px] text-slate-500 font-bold uppercase leading-none">NAME / नाम:</div>
                  <h3 className="text-[13.5px] font-black text-slate-900 truncate tracking-tight leading-tight mt-0.5">
                    {providerName}
                  </h3>
                  <div className="text-[8.5px] text-slate-700 font-bold flex items-center gap-1 mt-0.5">
                    <span className="text-slate-500 uppercase">GENDER / लिंग:</span>
                    <span className="text-slate-900">
                      {gender === 'MALE' ? 'MALE / पुरुष' : gender === 'FEMALE' ? 'FEMALE / महिला' : gender}
                    </span>
                  </div>
                </div>

                {/* Indian Flag on the Right */}
                <div className="shrink-0 w-12 h-8 rounded border border-slate-300 shadow-xs overflow-hidden">
                  <img src="/images/indian-flag.svg" alt="Indian Flag" className="w-full h-full object-cover" />
                </div>
              </div>

              {/* Trade & Skill Level Badges (Bigger) */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="bg-sky-600 text-white text-[8.5px] font-bold px-2 py-0.5 rounded shadow-xs truncate">
                  TRADE / व्यवसाय: {categoryName}
                </span>
                <span className="bg-slate-200 text-slate-800 text-[8.5px] font-bold px-1.5 py-0.5 rounded truncate">
                  SKILL: {skillLevel}
                </span>
              </div>

              {/* Issue & Validity Dates (Bigger) */}
              <div className="flex items-center gap-2 text-[8px] text-slate-700 font-medium pt-0.5">
                <span>ISSUED: <strong>{issueDateStr}</strong></span>
                <span>•</span>
                <span>VALID THRU: <strong className="text-emerald-700">{validThruStr}</strong></span>
              </div>

              {/* Notice Disclaimer Box (Generalized, multiline 2-line wrap) */}
              <div className="p-1 rounded border border-red-300 bg-red-50/90 text-[6.5px] text-red-900 leading-tight mt-0.5 whitespace-normal break-words">
                <span className="font-bold">NOTICE: </span>
                {disclaimer}
              </div>

              {/* Cardholder Signature under Notice */}
              <div className="flex flex-col items-end pt-0.5 pr-1">
                <span className="font-serif italic font-bold text-[11px] text-blue-900 tracking-wider leading-none">
                  {titleCaseName}
                </span>
                <div className="w-24 h-[1px] bg-slate-400 mt-0.5" />
                <span className="text-[5.5px] font-bold text-slate-500 uppercase tracking-tight mt-0.5">
                  हस्ताक्षर / Cardholder Signature
                </span>
              </div>
            </div>
          </div>

          {/* Bottom ID Number Bar */}
          <div className="w-full shrink-0">
            <div className="border-t border-slate-200 bg-slate-50/95 py-1 text-center">
              <div className="font-mono text-base font-black tracking-widest text-slate-900">
                {idNumber}
              </div>
            </div>
            {/* Bottom Tricolor Stripe */}
            <div className="h-0.5 bg-[#FF9933] w-full" />
            <div className="h-0.5 bg-white w-full" />
            <div className="h-0.5 bg-[#138808] w-full" />
          </div>
        </div>
      ) : (
        // BACK CARD PREVIEW (CR80 Standard)
        <div className="h-full w-full flex flex-col justify-between p-0 relative bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
          {/* Top Indian Tricolor Band */}
          <div className="w-full shrink-0">
            <div className="h-1 bg-[#FF9933] w-full" />
            <div className="h-0.5 bg-white w-full" />
            <div className="h-1 bg-[#138808] w-full" />

            {/* Header Navy Banner: Centered Title, No Lions, No Subtitle */}
            <div className="bg-[#0F172A] text-white px-3 py-2 flex items-center justify-center">
              <div className="text-[13.5px] font-black tracking-wider text-white uppercase text-center">
                {cardTitle}
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="px-3.5 py-1.5 flex gap-3 flex-grow items-center overflow-hidden">
            {/* Left Column: Multiline Address, Mobile, Email, Flag & Notice */}
            <div className="flex flex-col justify-center space-y-1 overflow-hidden flex-grow text-slate-900">
              <div>
                <span className="text-[8.5px] font-black text-slate-900 block">पता / ADDRESS:</span>
                <p className="text-[8px] text-slate-800 leading-tight font-medium line-clamp-2">
                  {address}
                </p>
              </div>

              {/* Mobile Number below Address */}
              <div className="text-[7.5px] font-bold text-slate-800 leading-tight">
                <span className="text-slate-500">मोबाईल / MOBILE:</span> {mobile}
              </div>

              {/* Email below Mobile */}
              <div className="text-[7.5px] font-bold text-slate-800 leading-tight truncate">
                <span className="text-slate-500">ईमेल / EMAIL:</span> {email}
              </div>

              {/* Indian Flag added below the email */}
              <div className="flex flex-col gap-0.5 pt-0.5">
                <div className="w-12 h-8 rounded border border-slate-300 shadow-xs overflow-hidden shrink-0">
                  <img src="/images/indian-flag.svg" alt="Indian Flag" className="w-full h-full object-cover" />
                </div>
                {/* Notice text below flag */}
                <div className="text-[6.5px] text-red-800 font-bold leading-tight mt-0.5">
                  This ID is not issued by Government.
                  <div className="text-[5.5px] text-red-600 font-normal">यह पहचान पत्र सरकार द्वारा जारी नहीं किया गया है।</div>
                </div>
              </div>
            </div>

            {/* Right Column: Prominent QR Code */}
            <div className="flex flex-col items-center shrink-0 w-28">
              <div className="w-24 h-24 p-1 bg-white border-2 border-slate-300 rounded-lg shadow-sm flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verifyUrl)}`}
                  alt="Verification QR Code"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as any).style.display = 'none';
                  }}
                />
              </div>
              <span className="text-[6.5px] text-slate-600 font-bold mt-0.5 text-center leading-tight">
                SCAN TO VERIFY CREDENTIALS
              </span>
            </div>
          </div>

          {/* Bottom Bar: Unique ID Number (Notice below removed as requested) */}
          <div className="w-full shrink-0">
            <div className="border-t border-slate-200 bg-slate-50/95 py-1 text-center">
              <div className="font-mono text-sm font-black tracking-widest text-slate-900">
                {idNumber}
              </div>
            </div>
            {/* Bottom Tricolor Stripe */}
            <div className="h-0.5 bg-[#FF9933] w-full" />
            <div className="h-0.5 bg-white w-full" />
            <div className="h-0.5 bg-[#138808] w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
