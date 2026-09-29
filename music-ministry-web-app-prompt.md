# Music Ministry — Worship Team Serving Schedule Web App

## 1. Mục tiêu

Tôi muốn xây dựng một web application dành cho **Music Ministry / Worship Team** để quản lý và đăng ký lịch serve hằng tuần.

Website có 2 loại tài khoản:

- `Admin`
- `User / Member`

Mỗi tuần sẽ có nhiều **buổi serve / service session**.

Mỗi buổi serve cần có thành viên thuộc 3 team:

1. **Sound Team**
2. **Singer**
3. **Musician**

Thành viên có thể đăng nhập, xem lịch của tuần hiện tại và đăng ký vào từng buổi với role mà mình mong muốn.

Admin có quyền quản lý toàn bộ lịch, thành viên và phân công.

---

# 2. Design direction — QUAN TRỌNG

Tôi sẽ cung cấp cho bạn **ảnh cover/reference ở attachment**.

Hãy sử dụng ảnh đó làm **visual reference chính cho toàn bộ design system**.

Ảnh này cũng phải được sử dụng trực tiếp làm **hero image ở đầu Landing Page**.

Không thiết kế một dashboard SaaS generic.

Không dùng style:

- corporate
- banking
- enterprise dashboard
- glassmorphism
- dark SaaS
- gradient-heavy modern SaaS

Website phải mang cảm giác:

> **Youthful Christian worship ministry + scrapbook/collage + retro editorial + playful music culture**

### Visual characteristics cần lấy từ ảnh

#### Color palette

Ưu tiên:

- warm off-white / cream background
- hot pink
- red
- electric blue / cobalt blue
- black
- white

Có thể lấy màu trực tiếp từ reference image nếu cần.

#### Typography

Logo / heading cần có typography:

- bold
- geometric
- slightly futuristic
- wide
- editorial
- condensed/bold display font cho những heading lớn

Body text vẫn phải dễ đọc.

#### Graphic language

Sử dụng các visual elements tương tự cover:

- checkerboard pattern
- pink/red checkerboard
- blue/white checkerboard
- irregular cut-out shapes
- thick white outlines
- cobalt-blue outlines
- sticker-like cards
- hand-drawn doodles
- stars
- globe
- music-related doodles
- circles
- arrows
- rough/organic shapes
- tilted images
- collage layout

Các decoration này nên được dùng có chủ đích, không spam.

### Important

UI phải **giữ được DNA của ảnh reference**, nhưng không copy nguyên bố cục của cover cho tất cả các page.

Landing page có thể rất expressive.

Dashboard/schedule page cần giảm decoration để ưu tiên usability.

---

# 3. Landing Page

Route:

```text
/
```

Landing page cần có các section:

## Hero

Hero section sử dụng **ảnh cover được cung cấp làm hình ảnh chính**.

Ảnh phải xuất hiện ở đầu landing page.

Desktop:

```text
┌───────────────────────────────────────────────────┐
│ decorative checkerboard / doodles                 │
│                                                   │
│             [COVER IMAGE]                         │
│                                                   │
│     Music Ministry                                │
│     Serve together. Worship together.             │
│                                                   │
│       [View Schedule] [Sign In]                   │
└───────────────────────────────────────────────────┘
```

Có thể overlay một số text/button lên hoặc đặt ngay bên dưới ảnh, nhưng **không được phá composition của cover**.

Mobile phải responsive và crop hợp lý.

Không làm ảnh bị méo.

---

## Intro section

Giới thiệu ngắn:

> Music Ministry  
> Serving together, worshipping together.

Có thể có 3 cards:

```text
SOUND
Support the worship experience

SINGER
Lead people in worship

MUSICIAN
Serve through music
```

Mỗi card có illustration/doodle nhỏ.

---

## How it works

3 bước:

```text
01
Sign in

02
Choose your serving role

03
Serve together
```

---

## CTA

CTA lớn:

> Ready to serve?

Button:

```text
VIEW THIS WEEK'S SCHEDULE
```

Nếu chưa login thì redirect đến login.

---

# 4. Authentication

Có:

```text
/login
/register
```

## Register

Form:

- Full name
- Email
- Password
- Confirm password

User **không được tự chọn Admin role**.

Khi register:

```text
role = USER
```

Admin chỉ có thể tạo/chuyển tài khoản thành admin thông qua admin dashboard.

---

# 5. Login

Login bằng:

- email
- password

Sau khi login:

### User

redirect:

```text
/schedule
```

### Admin

redirect:

```text
/admin
```

---

# 6. User Schedule Page

Đây là **core page của website**.

Route:

```text
/schedule
```

Mặc định hiển thị **tuần hiện tại**.

Cho phép chuyển:

```text
← Previous Week

September 21 – September 27, 2026

Next Week →
```

Có thể có nút:

```text
THIS WEEK
```

---

# 7. Weekly Schedule UI

Hiển thị các service trong tuần.

Ví dụ:

```text
THIS WEEK

┌──────────────────────────────────────────────┐
│ SUNDAY                                      │
│ September 27                                │
│ 09:00 AM                                    │
│ Morning Service                             │
│                                              │
│ SOUND                                        │
│ ● Nguyễn A                                   │
│                                              │
│ SINGER                                       │
│ ● Nguyễn B   ● Trần C                       │
│                                              │
│ MUSICIAN                                     │
│ ● Lê D       ● Phạm E                       │
│                                              │
│ [ JOIN THIS SERVICE ]                        │
└──────────────────────────────────────────────┘
```

Có thể sử dụng horizontal/vertical cards tùy screen size.

---

# 8. Registration behavior

Khi user click:

```text
JOIN THIS SERVICE
```

mở modal:

```text
Choose your serving role

○ Sound Team
○ Singer
○ Musician

[Confirm]
```

Sau khi confirm:

- tạo registration
- cập nhật UI ngay lập tức
- hiển thị tên user trong role tương ứng

Ví dụ:

```text
SINGER

● Mai
● An
● Linh
```

---

# 9. Registration rules

### Một user

Một user chỉ được đăng ký **một role trong một service**.

Ví dụ:

```text
Sunday 9:00

Mai → Singer
```

Không được:

```text
Mai → Singer
Mai → Musician
```

trong cùng một service.

Nhưng user có thể đăng ký role khác ở service khác.

Ví dụ:

```text
Sunday Morning → Singer
Sunday Evening → Musician
```

là hợp lệ.

---

# 10. User có thể chỉnh registration

Nếu user đã đăng ký:

Thay button:

```text
JOIN THIS SERVICE
```

thành:

```text
YOU'RE SERVING: SINGER

[Change Role]
[Cancel]
```

### Change Role

Cho phép chuyển:

```text
Singer → Musician
```

### Cancel

Cho phép user hủy đăng ký.

Cần confirmation:

> Are you sure you want to cancel your serving registration?

---

# 11. Service coverage indicator

Mỗi service cần hiển thị trạng thái coverage.

Ví dụ:

```text
SERVICE COVERAGE

✓ Sound       1 / 1
✓ Singer      3
✓ Musician    2
```

Nếu thiếu:

```text
⚠ Sound       0 / 1
✓ Singer      2
✓ Musician    3
```

Sử dụng visual indicator rõ ràng.

Không cần hard-code màu nếu không cần thiết, nhưng có thể dùng:

- green → fulfilled
- red/pink → missing
- yellow → warning

---

# 12. Important business rule

Mỗi service **bắt buộc phải có ít nhất một người thuộc mỗi team**:

```text
Sound Team ≥ 1
Singer ≥ 1
Musician ≥ 1
```

Singer và Musician có thể có nhiều thành viên.

Admin có thể cấu hình minimum/target nếu architecture phù hợp.

Không nên hard-code giới hạn tối đa nếu không cần thiết.

---

# 13. Admin Dashboard

Route:

```text
/admin
```

Admin dashboard phải có overview.

Ví dụ:

```text
THIS WEEK

Services
4

Members
24

Registrations
38

Needs Attention
2
```

---

# 14. Admin Schedule Management

Admin có thể:

### Create service

Form:

```text
Service name
Date
Start time
End time
Location
Notes
```

Ví dụ:

```text
Sunday Worship
September 27, 2026
09:00 – 11:00
Main Hall
```

### Edit service

Admin có thể thay đổi:

- name
- date
- time
- location
- notes

### Delete service

Có confirmation modal.

---

# 15. Admin schedule overview

Admin cần có một view đặc biệt để nhìn toàn bộ assignment.

Ví dụ:

```text
SEPTEMBER 21 – 27

                    SOUND       SINGER         MUSICIAN

Sunday 09:00        ✓ Mai       ✓ An          ✓ Nam
                                 ✓ Linh        ✓ Khoa

Sunday 18:00        ⚠ --        ✓ An          ✓ Minh

Wednesday 19:00     ✓ Hoa       ✓ Linh        ⚠ --
```

Admin nhìn vào phải nhận ra ngay:

- service nào đủ người
- team nào đang thiếu
- ai đang serve ở đâu

---

# 16. Admin có thể manually assign

Admin có quyền:

```text
Assign Member
```

Ví dụ:

```text
Sunday Morning

Singer

[ + Add Member ]

Search member...
```

Admin có thể thêm member vào service mà không cần member tự đăng ký.

Admin cũng có thể remove assignment.

---

# 17. Members Management

Route:

```text
/admin/members
```

Hiển thị:

```text
Name
Email
Role
Status
Joined date
Actions
```

Admin có thể:

- view member
- disable account
- enable account
- change role USER ↔ ADMIN
- delete account nếu cần

Không cho USER truy cập trang này.

---

# 18. Admin Service Management

Route:

```text
/admin/services
```

Danh sách:

```text
Service
Date
Time
Location
Sound
Singer
Musician
Status
Actions
```

Status:

```text
READY
NEEDS PEOPLE
```

---

# 19. User Profile

Route:

```text
/profile
```

Hiển thị:

```text
Name
Email
Account role

Serving history
```

Có thể có:

```text
Upcoming Services
Past Services
```

---

# 20. Database design

Nếu sử dụng Supabase/PostgreSQL, thiết kế database rõ ràng.

Suggested schema:

### profiles

```text
profiles
---------
id
full_name
email
role
status
created_at
updated_at
```

`role`:

```text
USER
ADMIN
```

`status`:

```text
ACTIVE
DISABLED
```

---

### services

```text
services
---------
id
title
date
start_time
end_time
location
notes
created_at
updated_at
```

---

### registrations

```text
registrations
-------------
id
service_id
user_id
team
created_at
updated_at
```

`team`:

```text
SOUND
SINGER
MUSICIAN
```

Add database constraint so:

```text
(service_id, user_id)
```

must be unique.

This guarantees one user cannot register twice for the same service.

---

# 21. Authentication & authorization

Use proper authentication.

Do NOT simply hide admin buttons on frontend.

Authorization must also be enforced server-side / database-level.

Rules:

### USER

Can:

```text
view services
create own registration
update own registration
delete own registration
view own profile
```

Cannot:

```text
create service
delete service
modify other users
modify other registrations
access admin dashboard
```

### ADMIN

Can:

```text
manage services
manage users
manage registrations
manually assign members
view all schedules
```

---

# 22. Responsive design

Must work properly on:

- Desktop
- Laptop
- Tablet
- Mobile

Mobile is important.

On mobile, weekly schedule should not become a huge table that requires horizontal scrolling.

Prefer:

```text
Date
↓
Service Card
↓
Team sections
```

For example:

```text
SUNDAY
Sep 27

Morning Worship
09:00 AM

┌───────────────┐
│ SOUND         │
│ ✓ Mai         │
├───────────────┤
│ SINGER        │
│ ✓ An          │
│ ✓ Linh        │
├───────────────┤
│ MUSICIAN      │
│ ✓ Nam         │
│ ✓ Khoa        │
└───────────────┘
```

---

# 23. Navigation

Desktop navbar:

```text
MUSIC MINISTRY

Schedule
About

                    [Profile]
                    [Logout]
```

Admin:

```text
MUSIC MINISTRY

Schedule
Admin
Members
Services

                    [Profile]
                    [Logout]
```

Logo/text should use the typography and visual language of the reference image.

---

# 24. Visual components

Create reusable components:

```text
Button
ServiceCard
TeamBadge
RegistrationModal
CoverageIndicator
MemberAvatar
WeekNavigator
Navbar
Footer
SectionHeading
Sticker
Doodle
CheckerPattern
```

Do not duplicate styling everywhere.

---

# 25. Image usage

The supplied cover image should be stored as an asset, for example:

```text
/public/images/music-ministry-cover.png
```

Use it in:

```text
Landing Page Hero
```

Do not recreate the cover with HTML/CSS.

Use the actual supplied image.

However, extract its **design language** for the rest of the website:

- colors
- patterns
- typography
- outlines
- stickers
- collage
- doodles

---

# 26. Suggested UI aesthetic

The website should feel like:

> a real youth worship ministry website

rather than:

> an employee scheduling SaaS.

For example, instead of boring:

```text
Service Schedule
```

you can use:

```text
LET'S SERVE 🎵
```

or:

```text
THIS WEEK'S SERVE
```

But maintain usability and don't overdo decorative text.

---

# 27. Landing page visual hierarchy

Use approximately this structure:

```text
┌─────────────────────────────────────────────────┐
│                                                 │
│              NAVIGATION                         │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│              COVER IMAGE                        │
│                                                 │
│        MUSIC MINISTRY                           │
│        SERVE TOGETHER                           │
│                                                 │
│       [VIEW SCHEDULE]                           │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│        SERVE THROUGH YOUR GIFT                  │
│                                                 │
│   [SOUND]   [SINGER]   [MUSICIAN]               │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│             HOW IT WORKS                        │
│                                                 │
│     01          02           03                 │
│   SIGN IN    CHOOSE ROLE    SERVE               │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│             READY TO SERVE?                     │
│                                                 │
│           [VIEW SCHEDULE]                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

# 28. Animation

Use subtle animations only.

Examples:

- card hover
- sticker slight rotation
- button hover
- page transition
- modal animation
- checkerboard decorative movement
- image reveal

Avoid excessive animation.

The website should feel energetic but still practical for people checking their schedule quickly.

---

# 29. Accessibility / UX

Make sure:

- buttons have clear labels
- sufficient contrast
- keyboard navigation works
- form errors are understandable
- loading states exist
- empty states exist
- error states exist
- destructive actions require confirmation

Examples:

Empty state:

> No services scheduled for this week yet.

No registration:

> You haven't signed up for this service yet.

---

# 30. Loading / error states

Implement proper:

```text
Loading skeleton
Empty state
Error state
Success toast
Confirmation modal
```

Example success:

> You're serving as Singer this Sunday 🎵

Example error:

> We couldn't update your registration. Please try again.

---

# 31. Seed data

Create development seed data so the application is immediately testable.

Create:

### Admin

```text
admin@musicministry.local
```

### Several users

```text
mai@musicministry.local
an@musicministry.local
linh@musicministry.local
nam@musicministry.local
khoa@musicministry.local
```

Create several services across one week and populate some registrations.

IMPORTANT:

The seed data should demonstrate both:

```text
fully covered service
```

and

```text
service missing a team
```

so the coverage UI can be tested.

Use clearly documented development passwords and never expose real credentials.

---

# 32. Tech stack

Prefer:

```text
Next.js
TypeScript
Tailwind CSS
Supabase
PostgreSQL
Supabase Auth
```

Use a component library only if it helps; do not let a generic component library determine the visual identity.

If the existing project already has a stack, **inspect it first and adapt to the existing architecture instead of unnecessarily rewriting the project**.

---

# 33. Code quality

Requirements:

- TypeScript strict mode
- reusable components
- clean folder structure
- no duplicated business logic
- proper loading/error handling
- proper auth guards
- server-side authorization
- database constraints
- environment variables
- no hard-coded API keys
- no fake authentication
- no fake persistence using localStorage

The application must use a real database/authentication layer.

---

# 34. Suggested folder architecture

If using Next.js App Router:

```text
app/
├── page.tsx
├── login/
│   └── page.tsx
├── register/
│   └── page.tsx
├── schedule/
│   └── page.tsx
├── profile/
│   └── page.tsx
└── admin/
    ├── page.tsx
    ├── members/
    │   └── page.tsx
    └── services/
        └── page.tsx

components/
├── ui/
├── layout/
├── schedule/
├── admin/
└── landing/

lib/
├── supabase/
├── auth/
├── services/
└── registrations/

types/
└── database.ts
```

Adapt this if the actual project architecture requires something different.

---

# 35. Implementation process

Do NOT immediately start writing random UI.

First:

### Step 1

Inspect the existing repository.

Understand:

- existing framework
- package manager
- existing components
- existing database configuration
- existing authentication
- existing styling system

### Step 2

Inspect the supplied reference image carefully.

Identify:

- dominant colors
- typography characteristics
- layout language
- decorative elements
- border/outline style
- image treatment

### Step 3

Create the design system.

Define:

```text
colors
typography
spacing
border radius
shadows
button styles
card styles
decorative patterns
```

### Step 4

Implement authentication.

### Step 5

Implement database schema.

### Step 6

Implement service scheduling.

### Step 7

Implement user registration.

### Step 8

Implement admin dashboard.

### Step 9

Implement landing page.

### Step 10

Responsive polish.

### Step 11

Test all user flows.

---

# 36. Required user flows

Test at minimum:

### Flow 1 — Register

```text
Landing
→ Register
→ Create account
→ Login
→ Schedule
```

### Flow 2 — User serves

```text
Login
→ Schedule
→ Select service
→ Choose Singer
→ Confirm
→ Registration appears
```

### Flow 3 — Change role

```text
Schedule
→ Existing registration
→ Change Role
→ Musician
→ Confirm
```

### Flow 4 — Cancel

```text
Schedule
→ Existing registration
→ Cancel
→ Confirm
→ Registration removed
```

### Flow 5 — Admin

```text
Admin Login
→ Admin Dashboard
→ Create Service
→ View Service
→ Manually Assign Member
→ See coverage
```

### Flow 6 — Authorization

Verify:

```text
USER cannot access /admin
USER cannot modify another user's registration
USER cannot create/delete service
```

---

# 37. Final visual requirement

The most important design principle:

**The cover image is the visual source of truth.**

I want the resulting website to look like it belongs to the **same visual universe as the supplied Music Ministry cover**.

Think:

> **Christian worship + music + youth ministry + retro collage + playful editorial design + bold typography**

Not:

> generic scheduling software.

At the same time, the actual schedule page must remain extremely easy to scan and use.

The final result should feel like a **real production-ready Music Ministry website**, not a demo dashboard.

---

# Final instruction

Before finishing, verify:

- authentication works
- USER/ADMIN permissions work
- database persistence works
- weekly navigation works
- registration works
- role switching works
- cancellation works
- admin assignment works
- coverage calculation works
- responsive layout works
- supplied cover image is used in landing hero
- overall visual language matches the supplied reference image

Do not stop after creating only the UI mockup. Implement the actual working application end-to-end.
