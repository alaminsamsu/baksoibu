/**
 * Mengambil tanggal operasional bisnis berdasarkan batas cutoff jam 06:00 WITA.
 * Jika input dilakukan antara jam 00:00 - 05:59 WITA, sistem mengembalikan tanggal kemarin.
 */
export function getOperationalDate(): string {
  const now = new Date();
  
  // Format waktu ke zona WITA (Asia/Makassar)
  const witaTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
  const witaDate = new Date(witaTimeStr);

  const hours = witaDate.getHours();

  // Jika sebelum jam 06:00 pagi, kurangi 1 hari
  if (hours < 6) {
    witaDate.setDate(witaDate.getDate() - 1);
  }

  const year = witaDate.getFullYear();
  const month = String(witaDate.getMonth() + 1).padStart(2, '0');
  const day = String(witaDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Mengecek apakah form closing/kasir malam masih dalam batas waktu input yang diizinkan (maksimal jam 06:00 WITA).
 */
export function isShift2InputAllowed(): boolean {
  const now = new Date();
  const witaTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
  const witaDate = new Date(witaTimeStr);
  const hours = witaDate.getHours();

  // Diizinkan dari jam 21:00 malam sampai jam 05:59 pagi
  return hours >= 21 || hours < 6;
}