import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: string | number, currency = "USD"): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  
  // If the number is a whole number, show no decimals
  // If it has decimals, show up to 2 decimal places but remove trailing zeros
  const isWholeNumber = numAmount % 1 === 0;
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: isWholeNumber ? 0 : 0,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

export function formatNumber(num: number, decimals = 2): string {
  const isWholeNumber = num % 1 === 0;
  
  return num.toLocaleString('en-US', {
    minimumFractionDigits: isWholeNumber ? 0 : 0,
    maximumFractionDigits: decimals
  });
}

export function generateQRCode(text: string): string {
  // Return a URL for generating a QR code via a reliable Google Chart API service
  // This service has high uptime and no rate limits for basic usage
  return `https://chart.googleapis.com/chart?cht=qr&chs=150x150&chl=${encodeURIComponent(text)}&choe=UTF-8`;
}

export function getRandomBackgroundPattern(): string {
  return `radial-gradient(rgba(242, 201, 76, 0.1) 2px, transparent 2px)`;
}
