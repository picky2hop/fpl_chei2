# Fantasy Player of the Week, Team of the Week และ Top/Bottom Share Design

## Goal

เพิ่ม Player of the Week, Team of the Week และการแชร์อันดับ Top 5/Bottom 5 ให้แอป Fantasy โดยใช้ข้อมูลสดจาก FPL ไม่เพิ่มตาราง Supabase และไม่เปลี่ยนพฤติกรรมของระบบทายผลเดิม

## Approved approach

ใช้แนวทาง A: ดึงข้อมูลจาก FPL แบบ on-demand ทุกครั้งที่เปิดหน้า Fantasy หรือกดปุ่ม Team of the Week โดยใช้ provider/server flow ที่มีอยู่ของโปรเจกต์เพื่อไม่เปิดเผย configuration ภายในและหลีกเลี่ยงปัญหา browser CORS

- ไม่สร้างตารางใหม่
- ไม่สร้าง migration
- ไม่เก็บ Player of the Week หรือ Team of the Week ถาวร
- ข้อมูล leaderboard, squad snapshot และ player statistics เดิมยังใช้ flow เดิม
- ไม่แก้ข้อมูล production จากฟีเจอร์ใหม่นี้
- ถ้าฟีเจอร์ใหม่โหลดไม่ได้ ให้แสดงสถานะในกล่องของฟีเจอร์นั้นเท่านั้น
- ไม่มีปุ่มลองใหม่ใน error state

## Scope

### In scope

1. การ์ด Player of the Week ต่อจากกัปตันยอดนิยมและรองกัปตันยอดนิยม
2. ปุ่มและ Popup Team of the Week
3. การ highlight Player of the Week ใน Popup/ Flex ที่เกี่ยวข้อง
4. ปุ่มแชร์ Top 5 และ Bottom 5 เป็น Flex message เดียวที่มี 2 bubbles
5. Automated tests สำหรับ normalization, fallback, rendering data และ Flex payload

### Out of scope

- การเก็บประวัติ Player of the Week หรือ Team of the Week ใน Supabase
- การเปลี่ยนสูตรคะแนน Fantasy เดิม
- การเปลี่ยนระบบ mapping หรือระบบทายผลพรีเมียร์ลีก
- การเพิ่ม captain ให้ Dream Team เมื่อ FPL API ไม่ได้ส่งข้อมูล captain
- การเพิ่ม Player of the Week highlight ในหน้าสถิตินักเตะหรือ Flex แชร์สถิตินักเตะ

## Functional behavior

### Player of the Week

เมื่อเปิดหน้า Fantasy ให้โหลดข้อมูลใหม่ทุกครั้งผ่าน `bootstrap-static`

1. ระบุ GW ปัจจุบันจาก normalized bootstrap data
2. ตรวจ `events[]` จาก GW ปัจจุบันลงไปหา GW ก่อนหน้า
3. ใช้ `top_element_info.points` เป็นคะแนนสูงสุดของ candidate GW
4. ใช้ `elements[]` จับคู่ player ID กับชื่อ สโมสร ตำแหน่ง และรูปภาพ
5. สำหรับ GW ปัจจุบัน ให้รวมผู้เล่นที่มี `event_points` เท่ากับคะแนนสูงสุด เพื่อรองรับคะแนนเสมอ
6. หาก candidate GW ข้อมูลไม่ครบ ให้ลอง GW ก่อนหน้าทีละ GW
7. หากต้อง fallback ไป GW ที่ผ่านมา ต้องใช้ข้อมูลคะแนนของ GW นั้นจาก FPL event-live data เพื่อไม่อ่าน `event_points` ของ GW ปัจจุบันมาใช้ผิด GW การเรียก event-live ทำเฉพาะกรณี fallback/ตรวจคะแนนเสมอที่จำเป็น และยังเป็นการดึงสดแบบไม่เก็บฐานข้อมูล
8. แสดงป้าย เช่น `Player of the Week · GW 5`
9. แสดงผู้เล่นที่เสมอกันทั้งหมดเป็นการ์ดแนวตั้งเรียงลงมา
10. ถ้าไม่มี candidate ที่ valid ตั้งแต่ GW ปัจจุบันถึง GW 1 ให้แสดง `ยังไม่มีข้อมูล Player of the Week`

การ์ดใช้ visual language เดิม สีเลมอน และป้าย `Player of the Week` พร้อมรูปนักเตะ ชื่อ สโมสร ตำแหน่ง และคะแนน GW

### Team of the Week

แสดงปุ่มใต้กลุ่มกัปตันยอดนิยม/รองกัปตันยอดนิยม โดยใช้ label ที่ระบุ GW ที่ใช้จริง เช่น `Team of the Week · GW 5`

เมื่อกดปุ่ม:

1. เริ่มจาก GW ปัจจุบัน
2. เรียก `https://fantasy.premierleague.com/api/dream-team/{gw}/`
3. ตรวจ response ว่าเป็น object และมี `team` ครบ 11 รายการ
4. ตรวจแต่ละรายการว่ามี `element`, `points` และ `position` ที่เป็นค่าถูกต้อง และ player ID ไม่ซ้ำ
5. ใช้ metadata จาก bootstrap เพื่อเติมชื่อ สโมสร ตำแหน่ง และรูปภาพ
6. ถ้า candidate ไม่ valid ให้ลอง GW ก่อนหน้าทีละ GW
7. แสดง GW ที่ใช้จริงใน Popup และ Flex
8. แสดง source เป็น `FPL Official` สีเลมอน และไม่มี profile picture
9. แสดงผู้เล่น 4 แถว: GK, กองหลัง, กองกลาง, กองหน้า โดยไม่มีตัวสำรอง
10. ถ้า response ไม่มี captain จะไม่สร้าง captain หรือคูณคะแนนเอง
11. ถ้าไม่มีข้อมูล valid ทุก GW ให้แสดงข้อความผิดพลาดเฉพาะส่วน Team of the Week และไม่แสดงปุ่มแชร์

การดึง Team of the Week เกิดเมื่อกดปุ่ม ไม่ดึงทุกครั้งที่เปิดหน้า เพื่อไม่เรียก endpoint โดยไม่จำเป็น

### Player of the Week highlight

กำหนด player IDs ของ Player of the Week ที่ใช้จริงและ GW เดียวกัน แล้วส่งเข้า presentation layer ของ:

- Popup ทีมของเพื่อน
- Flex แชร์ทีมของเพื่อน
- Popup Team of the Week
- Flex แชร์ Team of the Week

ผู้เล่นที่ตรงกับ ID จะมีพื้น/เส้นขอบสีเลมอนและข้อความ `Player of the Week` โดยไม่เปลี่ยนคะแนนดิบหรือสูตร captain multiplier

หน้าสถิตินักเตะและ Flex แชร์สถิตินักเตะไม่ใช้ highlight นี้

### Top 5 / Bottom 5 leaderboard share

เพิ่มปุ่มแชร์ด้านล่างตารางคะแนน เมื่อกดหนึ่งครั้งให้สร้าง Flex message เดียวที่มี 2 bubbles:

1. Bubble `Top 5`
2. Bubble `Bottom 5`

ข้อมูลใช้ leaderboard ที่ผู้ใช้กำลังดูอยู่ในขณะนั้น จึงเคารพ:

- ลีกที่เลือก
- GW ที่เลือก
- โหมด GW หรือทั้งฤดูกาล
- อันดับย้อนหลัง

การตัดกลุ่มใช้ rank ที่คำนวณแล้ว ไม่ตัดด้วย array index:

- Top 5: รวมทุกคนที่มี rank ไม่เกิน 5
- Bottom 5: เริ่มจาก rank ที่อยู่ในกลุ่มท้าย 5 อันดับ และรวมทุกคนที่แชร์ rank boundary เดียวกัน

ถ้าอันดับ 5 และ 6 มี rank เป็น 5 ทั้งคู่ ต้องแสดงทั้งสองคนในกลุ่ม Top 5 ตามกติกาอันดับร่วม

รูปแบบ row ให้ใช้แนวทางเดียวกับ Flex ตารางคะแนนเดิม:

- ลำดับ + รูป + ชื่อ และทีมอยู่ฝั่งซ้าย
- คะแนนอยู่ขวาสุด
- ใช้ข้อความ `ทีม`
- สีชื่อทีมเป็นสีเลมอนเดียวกับปุ่มแชร์
- จำกัดจำนวนเนื้อหาให้ผ่าน schema/size ของ LINE Flex และไม่ทำให้ทั้งข้อความส่งไม่สำเร็จ

## Architecture

### Existing boundaries to preserve

- `lib/fantasy/fpl-client.ts`: เป็นจุดรวมการเรียกและ normalize ข้อมูล FPL
- `lib/fantasy/fantasy-share-payload.ts`: เป็นจุดสร้าง Flex payload
- `app/fantasy/fantasy-app.tsx`: เป็นจุดประกอบ dashboard, popup และ state ของหน้า Fantasy
- `lib/fantasy/fantasy-share-actions.ts`: เป็นจุดเรียก LINE Share Target Picker ที่มีอยู่
- `lib/fantasy/types.ts`: เป็นจุดกำหนด type ที่ใช้ข้าม provider/service/UI

จะเพิ่ม pure normalizer/service แยกจาก JSX สำหรับ Player/Team of the Week เพื่อให้ fallback และ validation ทดสอบได้โดยไม่ต้อง mount หน้าเต็ม

### Suggested interfaces

ชื่อจริงจะยึด convention ของโปรเจกต์ตอน implementation แต่ contract ต้องเทียบเท่ากับรูปแบบนี้:

```ts
type FantasyPlayerOfWeek = {
  gameweek: number;
  topPoints: number;
  players: FantasySquadPlayer[];
};

type FantasyTeamOfWeek = {
  gameweek: number;
  source: "FPL Official";
  players: FantasySquadPlayer[];
};

type FantasyWeeklyFeatureState<T> =
  | { state: "loading" }
  | { state: "ready"; value: T }
  | { state: "unavailable"; message: string };
```

ผู้เล่นใน feature ใหม่ต้อง reuse field ที่ presentation/shared squad ใช้อยู่ เช่น player ID, name, club, position, photo URL, raw points และ captain flag แทนการสร้างข้อมูลผู้เล่นชุดที่สอง

## Data flow

### Page load

```text
FantasyApp mount
  -> existing Fantasy dashboard request
  -> Player/Team metadata loader from current bootstrap
  -> Player of the Week normalizer
  -> Player of the Week state
  -> PlayerStats cards render
```

Player of the Week failure ต้องถูกเก็บเป็น state แยกจาก `data` ของ leaderboard เพื่อไม่ให้ `FantasyApp` ตกไปอยู่หน้า error ทั้งหน้า

### Team of the Week button

```text
click Team of the Week
  -> loading popup state
  -> candidate GW current -> previous -> ... -> 1
  -> FPL dream-team endpoint
  -> validate and normalize
  -> popup ready/error state
  -> optional share action
```

คำขอ Team of the Week จะไม่เขียน Supabase และจะไม่แก้ current squad snapshot ของ Entry ใด

### Highlight data

Player of the Week result จะถูกส่งเข้า popup/share builder ในรูป `Set<number>` หรือ equivalent immutable ID collection เพื่อให้การตรวจ highlight เป็น deterministic และไม่ผูกกับชื่อผู้เล่นที่อาจเปลี่ยนแปลง

## Validation and fallback

### Player of the Week candidate

Candidate valid เมื่อ:

- GW number เป็นจำนวนเต็มในช่วง 1 ถึง current GW
- `top_element_info.points` เป็น number ที่ finite
- player metadata ของ top player หาได้
- ข้อมูลคะแนนสำหรับ candidate มีให้ระบุ player/points ได้

ถ้า candidate ไม่ผ่าน ให้ลอง GW ก่อนหน้าโดยไม่แสดงข้อมูลบางส่วนปนกับ GW อื่น

### Team of the Week candidate

Candidate valid เมื่อ:

- HTTP response สำเร็จ
- `team` เป็น array
- มีสมาชิกครบ 11 คน
- `element` เป็น positive integer และไม่ซ้ำ
- `points` เป็น finite number
- `position` มีค่าและ map เป็นตำแหน่งได้จาก metadata
- ผู้เล่นทุกคนจับคู่กับ bootstrap metadata ได้

ถ้าไม่ผ่านให้ทิ้ง candidate ทั้งชุดและ fallback ต่อ ไม่แสดงทีมที่มีข้อมูลไม่ครบ

### Error copy

ข้อความใน UI ต้องเป็นภาษาไทยและไม่เปิดเผยรายละเอียด upstream, token, URL ภายใน หรือ Supabase error ตัวอย่างข้อความ:

- `ยังไม่มีข้อมูล Player of the Week`
- `ไม่สามารถโหลด Player of the Week ได้ในขณะนี้`
- `ไม่สามารถโหลด Team of the Week ได้ในขณะนี้`

ไม่มี retry button ตามที่อนุมัติ

## UI flow and accessibility

- การ์ด Player of the Week เรียงแนวตั้งบน mobile
- Team of the Week ใช้ modal เดิมของทีมเพื่อนในด้าน backdrop, close button และ mobile sizing
- Modal ต้องมี `role="dialog"`, `aria-modal="true"`, accessible title และปุ่มปิด
- Loading state ต้องไม่ทำให้ปุ่มอื่นใน dashboard ถูก disable
- Error state ใช้ `role="alert"`
- สีเลมอนต้องมีข้อความ/label ร่วมด้วย ไม่ใช้สีเป็นตัวบอกสถานะเพียงอย่างเดียว
- ผู้เล่นที่เป็น Player of the Week ต้องอ่านได้จาก text label ใน popup/Flex ไม่ใช่ดูจากสีอย่างเดียว

## Flex constraints

Flex builders ต้องสร้าง payload ผ่าน helper เดิมและทดสอบด้วย JSON serialization ก่อนส่ง LINE

- Team of the Week ใช้ 1 bubble
- Top/Bottom ใช้ 2 bubbles ใน Flex message เดียว
- ไม่ใส่ header `FPL CHEI CHEI` ใน share layouts ที่ผู้ใช้สั่งตัดออกก่อนหน้านี้
- ไม่แสดง FPL Entry ID ใน leaderboard row
- คะแนนรวมของทีมเพื่อนยังใช้กติกา starter + captain multiplier เดิม
- Team of the Week ใช้คะแนนที่ API ส่งมา และไม่คูณ captain เมื่อไม่มี captain field
- ทุก image URL ต้องผ่าน validation/fallback เดิม เพื่อไม่ให้ invalid URL ทำให้ Flex ทั้งชุดส่งไม่สำเร็จ

## Testing strategy

ใช้ test-first ตาม `superpowers:test-driven-development`:

### Pure unit tests

- current GW Player of the Week จาก bootstrap
- tied Player of the Week หลายคน
- Player of the Week fallback และ no-data
- Team of the Week response ครบ 11 คน
- Team of the Week rejects duplicate/missing players
- Team of the Week fallback และ no-data
- no captain does not add captain multiplier
- Top 5 / Bottom 5 includes tied rank boundary
- Player of the Week highlight matches by player ID

### Flex payload tests

- Top/Bottom returns one message with exactly two bubbles
- rows preserve left/right alignment contract and `ทีม` label
- Team of the Week returns one bubble and includes actual GW/source
- highlighted player receives lemon label/style
- invalid/missing optional image does not produce an invalid Flex image block

### UI/integration tests

- page load keeps main dashboard visible when weekly feature fails
- Player of the Week cards render vertically
- Team of the Week button opens loading then success/error state
- error state has no retry button
- selected league/GW/mode are passed into Top/Bottom share action

### Required verification before completion

```text
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
```

No completion claim or commit/push is allowed until all required checks have been run and their output reviewed.

## Self-review

### Coverage check

- Player of the Week current/latest behavior: covered in Functional behavior and Data flow
- Vertical layout: covered in UI flow
- Ties: covered in normalization and tests
- Fallback to previous GW and actual GW label: covered for both features
- No valid data message and no retry: covered in Error handling and tests
- Dream Team API shape, 11 players, no invented captain: covered in Team of the Week and validation
- Highlight only in approved popup/Flex locations: covered in Highlight data and out-of-scope list
- Top/Bottom two-bubble share, selected league/GW/mode, boundary ties: covered in leaderboard share and Flex tests
- No database changes and no production data writes: covered in scope and data flow
- Existing prediction/Fantasy boundaries: covered in architecture
- Automated tests and final verification commands: covered in Testing strategy

### Ambiguity review

- Historical Player of the Week points cannot safely be reconstructed from only the current `elements[].event_points`; the design therefore uses FPL event-live data only when a prior-GW fallback or historical tie resolution is required.
- Dream Team `position` is normalized using FPL player metadata instead of assuming numeric slot semantics.
- Top/Bottom boundary behavior is explicitly rank-based and includes all tied rows at the boundary.

### Scope review

No schema change, admin UI, mapping change, prediction change, or long-term weekly archive was added. The implementation remains limited to the three approved Fantasy dashboard/share features.

## Approval gate

This document is the implementation contract. Implementation must not begin until the user reviews and approves this document. After approval, create the implementation plan with `superpowers:writing-plans`, then wait for plan approval before writing code.
