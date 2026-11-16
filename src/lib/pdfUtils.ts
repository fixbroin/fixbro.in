
"use client";

import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from '@/lib/mysqlStorage';
import { nanoid } from 'nanoid';
import { isWebView, requestFileDownload } from './webview-bridge'; // Import WebView bridge functions

/**
 * Converts a data URI string to a Blob object.
 * @param dataURI The data URI string (e.g., "data:application/pdf;base64,...").
 * @returns A Blob object or null if conversion fails.
 */
export function dataUriToBlob(dataURI: string): Blob | null {
  try {
    const parts = dataURI.split(',');
    if (parts.length < 2) return null;
    const base64Data = parts[1].replace(/[\r\n\s]/g, '');
    const byteString = atob(base64Data);
    const mimeString = (parts[0].split(':')[1] || 'application/pdf').split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch (error) {
    console.error("Error converting data URI to Blob:", error);
    return null;
  }
}

/**
 * Uploads a PDF Blob to Firebase Storage.
 * @param pdfBlob The PDF Blob to upload.
 * @param storagePath The desired path in Firebase Storage (e.g., "quotations_pdf/quotationId.pdf").
 * @returns A Promise that resolves with the public downloadable URL of the uploaded PDF.
 */
export async function uploadPdfToStorage(pdfBlob: Blob, storagePath: string): Promise<string> {
  if (!(pdfBlob instanceof Blob)) {
    throw new Error("Invalid PDF Blob provided for upload.");
  }
  const fileRef = storageRef(storage, storagePath);
  try {
    const snapshot = await uploadBytes(fileRef, pdfBlob, {
      contentType: 'application/pdf',
    });
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading PDF to Firebase Storage:", error);
    throw error; // Re-throw to be caught by the caller
  }
}

/**
 * Triggers a browser download for a PDF from a data URI, or requests a native download if in a WebView.
 * Uses Blob object URL for standard browsers to bypass Chromium/Edge restrictions on top-level data URIs.
 * @param pdfDataUri The data URI string of the PDF.
 * @param fileName The desired file name for the download (e.g., "quotation-123.pdf").
 */
export function triggerPdfDownload(pdfDataUri: string, fileName: string): void {
  try {
    const hasFlutterBridge = typeof window !== 'undefined' && Boolean(
      ((window as any).FlutterBridge && typeof (window as any).FlutterBridge.postMessage === 'function') ||
      ((window as any).flutter_inappwebview && typeof (window as any).flutter_inappwebview.callHandler === 'function')
    );

    if (hasFlutterBridge) {
      // In active Flutter WebView, request the native app to handle the download.
      requestFileDownload(pdfDataUri, fileName);
      return;
    }

    // Standard cross-browser web download behavior using Blob URL
    let downloadUrl = pdfDataUri;
    let objectUrl: string | null = null;

    if (pdfDataUri.startsWith('data:')) {
      const blob = dataUriToBlob(pdfDataUri);
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        downloadUrl = objectUrl;
      }
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link); // Required for Firefox and some Chromium versions
    link.click();

    setTimeout(() => {
      try {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (e) {}
    }, 2000);
  } catch (error) {
    console.error("Error triggering PDF download:", error);
  }
}
