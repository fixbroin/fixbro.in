"use client";

import React from 'react';
import type { IdCardRenderOptions } from "@/lib/idCardRenderer";

interface OfficialIdCardViewProps {
  data: IdCardRenderOptions;
  activeSide: 'front' | 'back';
}

export default function OfficialIdCardView({ data, activeSide }: OfficialIdCardViewProps) {
  const providerName = (data.providerName || 'AUTHORIZED PARTNER').toUpperCase();
  const categoryName = (data.categoryName || 'General').toUpperCase();
  const cardTitle = `INDIAN ${categoryName} ID CARD`;
  const gender = (data.gender || 'Male').toUpperCase();
  const skillLevel = (data.skillLevelLabel || 'Skilled Professional').toUpperCase();
  const idNumber = data.idCardNumber || '1001';
  const issueDateStr = data.issueDateStr || '11/2026';
  const validThruStr = data.validThruStr || '11/2028';
  const address = data.residentialAddress || 'Address on record with FixBro';
  const disclaimer = data.disclaimerText || 'This ID card is issued by FixBro Private Platform for verified partner identification. Not a Government of India document.';
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

              {/* Notice Disclaimer Box (Multiline 2-line wrap, no cutoff!) */}
              <div className="p-1 rounded border border-red-300 bg-red-50/90 text-[6.5px] text-red-900 leading-tight mt-0.5 whitespace-normal break-words">
                <span className="font-bold">NOTICE: </span>
                {disclaimer}
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
            {/* Left Column: Multiline Address (Bigger) & Indian Flag Below */}
            <div className="flex flex-col justify-center space-y-1.5 overflow-hidden flex-grow text-slate-900">
              <div>
                <span className="text-[9px] font-black text-slate-900 block">पता / ADDRESS:</span>
                <p className="text-[8.5px] text-slate-800 leading-tight font-medium line-clamp-3">
                  {address}
                </p>
              </div>

              {/* Indian Flag added below the address in the gap! */}
              <div className="flex items-center gap-3 pt-1">
                <div className="w-14 h-9 rounded border border-slate-300 shadow-xs overflow-hidden shrink-0">
                  <img src="/images/indian-flag.svg" alt="Indian Flag" className="w-full h-full object-cover" />
                </div>
                <div className="text-[6.5px] text-slate-500 font-semibold leading-tight">
                  <div className="font-bold text-slate-800 italic">FixBro Platform</div>
                  Official Partner Verification
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

          {/* Bottom Bar: Unique ID Number & Legal Disclaimer */}
          <div className="w-full shrink-0">
            <div className="border-t border-slate-200 bg-slate-50/95 py-1 text-center">
              <div className="font-mono text-sm font-black tracking-widest text-slate-900">
                {idNumber}
              </div>
              <div className="text-[6.5px] text-slate-500 font-medium leading-none mt-0.5">
                This ID card is issued by a private platform (FixBro), not issued by government.
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
