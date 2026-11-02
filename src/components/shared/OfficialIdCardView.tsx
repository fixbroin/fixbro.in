"use client";

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { QrCode, ShieldCheck, Phone, CheckCircle2 } from "lucide-react";
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
  const idNumber = data.idCardNumber || '3617 0760 1001';
  const issueDateStr = data.issueDateStr || '11/2026';
  const validThruStr = data.validThruStr || '11/2028';
  const address = data.residentialAddress || 'Address not registered with FixBro';
  const helpline = data.helplinePhone || '+91 8000 123 456';
  const signatory = data.signatoryName || 'Authorized Signatory - FixBro';
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
            
            {/* Header Navy Banner */}
            <div className="bg-[#0F172A] text-white px-3 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src="/images/ashoka-emblem.svg"
                  alt="Ashoka Lion Emblem"
                  className="h-8 w-auto object-contain filter invert"
                />
                <div className="leading-tight">
                  <div className="text-[12px] font-black tracking-wide text-white uppercase">
                    {cardTitle}
                  </div>
                  <div className="text-[7.5px] text-slate-400 font-semibold tracking-wider">
                    VERIFIED SERVICE PROFESSIONAL • सेवा पेशेवर पहचान पत्र
                  </div>
                </div>
              </div>
              <span className="bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm shrink-0">
                ✓ VERIFIED
              </span>
            </div>
          </div>

          {/* Card Body */}
          <div className="px-3 py-1.5 flex gap-3 flex-grow items-center overflow-hidden">
            {/* Left Photo Column (Bigger, NO SIM Card!) */}
            <div className="flex flex-col items-center shrink-0 w-24">
              <div className="w-24 h-28 rounded-lg overflow-hidden border-2 border-slate-400 bg-slate-200 flex items-center justify-center relative shadow-sm">
                {data.profilePhotoUrl ? (
                  <img src={data.profilePhotoUrl} alt={providerName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-slate-600">{providerName.charAt(0)}</span>
                )}
              </div>
              <div className="w-24 mt-1 bg-slate-900 text-emerald-400 text-[6.5px] font-bold text-center py-0.5 rounded shadow-xs">
                ✓ KYC VERIFIED
              </div>
            </div>

            {/* Right Information Column */}
            <div className="flex flex-col justify-center space-y-0.5 overflow-hidden flex-grow text-slate-900">
              {/* Name (Bigger as requested) */}
              <div>
                <div className="text-[7px] text-slate-500 font-bold uppercase leading-none">NAME / नाम:</div>
                <h3 className="text-sm font-black text-slate-900 truncate tracking-tight leading-tight">
                  {providerName}
                </h3>
              </div>

              {/* Gender */}
              <div className="text-[8px] text-slate-700 font-bold flex items-center gap-1">
                <span className="text-slate-500 uppercase">GENDER / लिंग:</span>
                <span className="text-slate-900">
                  {gender === 'MALE' ? 'MALE / पुरुष' : gender === 'FEMALE' ? 'FEMALE / महिला' : gender}
                </span>
              </div>

              {/* Trade & Skill Level Badges */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="bg-sky-600 text-white text-[7.5px] font-bold px-1.5 py-0.5 rounded truncate">
                  TRADE: {categoryName}
                </span>
                <span className="bg-slate-200 text-slate-800 text-[7.5px] font-bold px-1.5 py-0.5 rounded truncate">
                  SKILL: {skillLevel}
                </span>
              </div>

              {/* Issue & Validity Dates */}
              <div className="flex items-center gap-2 text-[7px] text-slate-600 pt-0.5">
                <span>ISSUED: <strong>{issueDateStr}</strong></span>
                <span>•</span>
                <span>VALID THRU: <strong className="text-emerald-700">{validThruStr}</strong></span>
              </div>

              {/* Red/Navy Boxed Private Legal Disclaimer (Aadhaar Style) */}
              <div className="p-1 rounded border border-red-300 bg-red-50/80 text-[6.5px] text-red-900 leading-tight mt-0.5">
                <span className="font-bold">NOTICE: </span>
                {disclaimer}
              </div>
            </div>
          </div>

          {/* Bottom ID Number Bar (Bold 12-digit Aadhaar Style) */}
          <div className="w-full shrink-0">
            <div className="border-t border-slate-200 bg-slate-50/90 py-1 text-center">
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

            <div className="bg-[#0F172A] text-white px-3 py-1.5 flex items-center gap-2">
              <img
                src="/images/ashoka-emblem.svg"
                alt="Ashoka Lion Emblem"
                className="h-7 w-auto object-contain filter invert"
              />
              <div className="leading-tight">
                <div className="text-[11px] font-black tracking-wide text-white uppercase">
                  {cardTitle}
                </div>
                <div className="text-[7px] text-slate-400 font-semibold tracking-wider">
                  VERIFICATION & REGISTRATION DETAILS • सत्यापन एवं संपर्क विवरण
                </div>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="px-3 py-1.5 flex gap-3 flex-grow items-center overflow-hidden">
            {/* Left Column: Multiline Address & Helpline */}
            <div className="flex flex-col justify-center space-y-1 overflow-hidden flex-grow text-slate-900">
              <div>
                <span className="text-[8px] font-black text-slate-900 block">पता / ADDRESS:</span>
                <p className="text-[7.5px] text-slate-700 leading-tight font-medium line-clamp-3">
                  {address}
                </p>
              </div>

              <div className="pt-0.5">
                <span className="text-[7.5px] font-bold text-slate-900">CUSTOMER SUPPORT: </span>
                <span className="text-[7.5px] font-bold text-sky-600">{helpline}</span>
                <span className="text-[7px] text-slate-500 block">www.fixbro.in</span>
              </div>

              {/* Digital Signatory */}
              <div className="pt-1">
                <div className="w-32 border-b border-slate-400" />
                <div className="text-[8px] italic font-serif text-slate-800 font-bold leading-tight pt-0.5">
                  FixBro Verification Authority
                </div>
                <div className="text-[6px] text-slate-500 font-semibold">{signatory}</div>
              </div>
            </div>

            {/* Right Column: Large QR Code (Aadhaar Style) */}
            <div className="flex flex-col items-center shrink-0 w-28">
              <div className="w-24 h-24 p-1 bg-white border-2 border-slate-300 rounded-lg shadow-sm flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`}
                  alt="Verification QR Code"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback to lucide QrCode icon if api.qrserver is unreachable
                    (e.currentTarget as any).style.display = 'none';
                  }}
                />
              </div>
              <span className="text-[6px] text-slate-600 font-bold mt-0.5 text-center leading-tight">
                SCAN TO VERIFY CREDENTIALS
              </span>
            </div>
          </div>

          {/* Bottom Bar: Unique ID Number & Legal Disclaimer */}
          <div className="w-full shrink-0">
            <div className="border-t border-slate-200 bg-slate-50/90 py-1 text-center">
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
