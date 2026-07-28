# Premier League Predictions MVP Design

## Goal

สร้างหน้าเว็บ MVP สำหรับกลุ่มผู้ใช้ขนาดเล็กที่เปิดจาก LINE แล้วเห็นประสบการณ์ทายผลพรีเมียร์ลีกที่รวดเร็ว อ่านง่าย และพร้อมต่อยอดไป LIFF, Supabase, FPL API และ LINE Messaging API ในระยะถัดไป

## Scope ระยะที่ 1

- Landing page ที่มีทางเลือก “แฟนตาซีเชยเชย” (ยังไม่เปิดใช้) และ “ทายผลพรีเมียร์ลีก”
- Preview LIFF gate ที่ตรวจ `NEXT_PUBLIC_LIFF_ID` และให้ใช้ demo profile เมื่อยังไม่มี credential เพื่อดู UI ได้
- แอปหลักแบบ mobile-first มี 3 tabs: ตารางคะแนน, ทายผล, ผลการแข่งขัน
- Mock data สำหรับผู้เล่น, สโมสร, โปรแกรมการแข่งขัน และผลทาย
- เปลี่ยน gameweek ด้วย dropdown แล้วอัปเดตข้อมูลใน client ทันที
- เลือก เหย้าชนะ/เสมอ/เยือนชนะ พร้อมสีแดง/เขียว/น้ำเงิน
- ยืนยันผลทายและแสดง confirmation modal พร้อมตัวเลือกแชร์แบบ preview
- แสดงรูปโปรไฟล์และตราสโมสรจาก URL ที่กำหนดใน mock data

ยังไม่อยู่ใน scope: การเรียก LIFF SDK จริง, Supabase schema/RLS, FPL API proxy, LINE Messaging webhook/Flex Message จริง, ระบบผู้ดูแล, และ deployment configuration ที่ต้องใช้ secret จริง

## UX และ visual direction

ใช้พื้นหลัง navy เข้มเป็น shell หลัก ตัดด้วยพื้นผิว slate/white cards, lime accent สำหรับ action และ status, coral/green/blue สำหรับผลทาย โครงสร้างเป็น single-column กว้างไม่เกิน 520px เพื่อเหมาะกับ LINE WebView แต่มี responsive padding สำหรับจอใหญ่

หน้าหลักใช้ top header แสดงชื่อผู้ใช้และ avatar, hero card แสดง gameweek ปัจจุบัน, segmented tab bar แบบ sticky และ card list ที่มีลำดับสายตาชัดเจน ตารางจัดอันดับใช้ rank, avatar, ชื่อ, คะแนน และ trend; หน้าทายผลเน้นคู่แข่งและปุ่ม 3 ตัวเลือก; หน้าผลการแข่งขันแบ่งผู้ทายออกเป็นสามฝั่งพร้อมเปอร์เซ็นต์

## Architecture

- `app/page.tsx` เป็น Server Component สำหรับ shell ที่ไม่ต้องใช้ browser API
- `app/dashboard/page.tsx` เป็น route สำหรับ app หลัก
- `app/components/prediction-app.tsx` เป็น Client Component หลักที่ถือ tab/gameweek/selection/modal state
- `lib/mock-data.ts` รวม types และข้อมูลตัวอย่างที่มี shape ใกล้กับ domain จริง
- `lib/predictions.ts` รวม pure functions เช่น เปลี่ยนผลทายและคำนวณเปอร์เซ็นต์ เพื่อทดสอบแยกจาก UI
- `app/globals.css` กำหนดพื้นผิว, สี, typography และ utility class ที่ใช้ซ้ำ

เมื่อเชื่อมจริงในระยะถัดไป ให้แทน mock data ด้วย server-side data access/API route โดยเก็บ secret ไว้ฝั่ง server และส่งเฉพาะ serializable props เข้า Client Component ตามแนวทาง App Router ของ Next.js 16

## Data flow ระยะที่ 1

1. ผู้ใช้เข้าหน้า `/` และเลือกเกมทายผล
2. route `/dashboard` แสดง preview gate/profile และ mock gameweek 28
3. state `activeTab`, `selectedGameweek`, `predictions` ถูกถือไว้ใน client component
4. dropdown เปลี่ยน gameweek แล้วเลือกชุด fixture/ranking/result จาก mock data ทันที
5. กดยืนยันเมื่อเลือกครบทุกคู่ จะเปิด modal ให้เลือกแชร์หรือปิด

## Error and empty states

- ไม่มี LIFF ID: แสดง badge “Preview mode” และ profile ตัวอย่างอย่างชัดเจน
- ไม่มีผลทายสำหรับ gameweek: แสดง empty card และไม่อนุญาตให้ยืนยันจนกว่าจะเลือกครบ
- รูปภาพภายนอกโหลดไม่ได้: ใช้ `img` พร้อม `onError` fallback initials ใน client component เพื่อไม่ให้ layout พัง
- ข้อมูล fixture มีสถานะ `upcoming`, `live`, `finished` เพื่อให้ระยะถัดไปต่อข้อมูลจริงได้โดยไม่เปลี่ยน UI contract

## Testing

- ทดสอบ pure prediction helpers ด้วย Node test runner บน TypeScript type stripping
- ทดสอบว่า gameweek มีข้อมูล, การเลือกผลทายครบคู่, และการคำนวณสัดส่วนผู้ทายแบบไม่หารด้วยศูนย์
- ตรวจ lint และ production build หลังประกอบ UI

## Success criteria

- `npm run lint` และ `npm run build` ผ่าน
- เปิด `/` เห็น landing page และกดเข้า `/dashboard` ได้
- เปลี่ยน tab และ gameweek ได้โดยไม่ reload
- เลือกผลทายครบแล้วกดยืนยันเห็น modal
- ไม่มี secret จริงถูก commit และมี `.env.example` อธิบายค่า LIFF ที่ต้องเติมในระยะถัดไป
