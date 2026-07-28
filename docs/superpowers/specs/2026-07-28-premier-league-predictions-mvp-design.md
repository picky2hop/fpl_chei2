# Premier League Predictions MVP Design

## Goal

สร้างหน้าเว็บ MVP สำหรับกลุ่มผู้ใช้ขนาดเล็กที่เปิดจาก LINE แล้วเห็นประสบการณ์ทายผลพรีเมียร์ลีกที่รวดเร็ว อ่านง่าย และพร้อมต่อยอดไป LIFF, Supabase, FPL API และ LINE Messaging API ในระยะถัดไป

## Scope ระยะที่ 1

- Landing page ที่มีทางเลือก “แฟนตาซีเชยเชย” (ยังไม่เปิดใช้) และ “ทายผลพรีเมียร์ลีก”
- LIFF gate ตั้งแต่ Landing: เมื่อมี `NEXT_PUBLIC_LIFF_ID` ให้ init และ login อัตโนมัติ, เมื่อไม่มีค่าให้ใช้ demo profile เฉพาะ preview mode
- แอปหลักแบบ mobile-first มี 3 tabs: ตารางคะแนน, ทายผล, ผลการแข่งขัน
- Mock data สำหรับผู้เล่น, สโมสร, โปรแกรมการแข่งขัน และผลทาย
- เปลี่ยน gameweek ด้วย dropdown แล้วอัปเดตข้อมูลใน client ทันที
- เลือก เหย้าชนะ/เสมอ/เยือนชนะ พร้อมสีแดง/เขียว/น้ำเงิน
- ยืนยันผลทายและแสดง confirmation modal พร้อมตัวเลือกแชร์แบบ preview
- แสดงรูปโปรไฟล์และตราสโมสรด้วย SVG URL จาก Premier League resource
- กดชื่อผู้เล่นในตารางคะแนนเพื่อดูคำทายของผู้เล่นใน gameweek ที่เลือก
- กดคู่แข่งขันในผลการแข่งขันเพื่อดูรายละเอียดผู้ทาย รูปโปรไฟล์ และคำทายแยกเหย้า/เสมอ/เยือน
- ใช้ bottom navigation แบบ fixed พร้อม safe-area สำหรับมือถือ
- ใช้ animation เฉพาะ loading, tab transition, modal และ success state

ยังไม่อยู่ใน scope: การเรียก LIFF SDK จริง, Supabase schema/RLS, FPL API proxy, LINE Messaging webhook/Flex Message จริง, ระบบผู้ดูแล, และ deployment configuration ที่ต้องใช้ secret จริง

## UX และ visual direction

ใช้พื้นหลัง navy เข้มแบบเดียวกับ Landing เป็น shell หลักทั้งแอป ตัดด้วยพื้นผิว navy/slate cards, lime accent สำหรับ action และ status, coral/green/blue สำหรับผลทาย โครงสร้างเป็น single-column กว้างไม่เกิน 520px เพื่อเหมาะกับ LINE WebView แต่มี responsive padding สำหรับจอใหญ่

หน้าหลักใช้ top header แสดงชื่อผู้ใช้และ avatar ตั้งแต่ Landing, hero card แสดง gameweek ปัจจุบัน และ bottom navigation แบบ fixed ที่ไม่แย่งพื้นที่ content ตารางจัดอันดับใช้ rank, avatar, ชื่อ, คะแนน และ trend; หน้าทายผลเน้นคู่แข่งและปุ่ม 3 ตัวเลือก; หน้าผลการแข่งขันแบ่งผู้ทายออกเป็นสามฝั่งพร้อมเปอร์เซ็นต์และเปิดรายละเอียดได้

## Architecture

- `app/page.tsx` เป็น Client entry gate สำหรับ LIFF login และแสดง Landing หลัง login state พร้อมใช้
- `app/dashboard/page.tsx` เป็น route สำหรับ app หลัก
- `app/components/prediction-app.tsx` เป็น Client Component หลักที่ถือ tab/gameweek/selection/modal state และ detail modals
- `app/components/liff-gate.tsx` เป็น Client Component ที่ init/login/profile ของ LIFF และมี preview fallback
- `lib/mock-data.ts` รวม types และข้อมูลตัวอย่างที่มี shape ใกล้กับ domain จริง
- `lib/predictions.ts` รวม pure functions เช่น เปลี่ยนผลทาย, คำนวณเปอร์เซ็นต์ และสร้าง detail rows เพื่อทดสอบแยกจาก UI
- `app/globals.css` กำหนดพื้นผิว, สี, typography และ utility class ที่ใช้ซ้ำ

เมื่อเชื่อมจริงในระยะถัดไป ให้แทน mock data ด้วย server-side data access/API route โดยเก็บ secret ไว้ฝั่ง server และส่งเฉพาะ serializable props เข้า Client Component ตามแนวทาง App Router ของ Next.js 16

## Data flow ระยะที่ 1

1. ผู้ใช้เข้าหน้า `/` และ LIFF gate เริ่ม init/login ก่อนแสดง profile; preview mode ใช้เมื่อไม่มี LIFF ID
2. ผู้ใช้เลือก “ทายผลพรีเมียร์ลีก” แล้ว route `/dashboard` แสดง mock gameweek 28
3. state `activeTab`, `selectedGameweek`, `predictions`, `selectedPlayer`, `selectedFixture` ถูกถือไว้ใน client component
4. dropdown เปลี่ยน gameweek แล้วเลือกชุด fixture/ranking/result จาก mock data ทันที
5. กดชื่อผู้เล่นหรือคู่แข่งขันเพื่อเปิด detail modal แบบไม่เปลี่ยน route
6. กดยืนยันเมื่อเลือกครบทุกคู่ จะเปิด success/share modal

## Error and empty states

- ไม่มี LIFF ID: แสดง badge “Preview mode” และ profile ตัวอย่างอย่างชัดเจน
- LIFF init/login ล้มเหลว: แสดง setup/error state ที่อ่านง่ายและปุ่มลองใหม่ โดยไม่เปิดข้อมูลจริงโดยไม่ยืนยันตัวตน
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
- เปิด `/` แล้วเห็น LIFF profile หรือ preview profile ก่อนเข้า app
- เปลี่ยน tab และ gameweek ได้โดยไม่ reload
- bottom navigation อยู่ตลอดขณะ scroll และไม่บัง content
- เปิด player detail และ fixture detail modal ได้
- เลือกผลทายครบแล้วกดยืนยันเห็น modal
- ไม่มี secret จริงถูก commit และมี `.env.example` อธิบายค่า LIFF ที่ต้องเติมในระยะถัดไป
