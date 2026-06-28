# Đưa PASTELLE NAILS lên VPS

Cấu hình này chạy ba container:

- `caddy`: nhận truy cập từ Internet và tự cấp/gia hạn HTTPS.
- `app`: Node.js/Express, không mở cổng trực tiếp ra Internet.
- `db`: PostgreSQL, không mở cổng trực tiếp ra Internet.

Database, chứng chỉ HTTPS và `public/uploads` đều nằm trong Docker volume nên
không mất khi build hoặc cập nhật app.

## 1. Chuẩn bị

- VPS Ubuntu có tối thiểu 1 GB RAM.
- Đã cài Docker Engine và Docker Compose plugin.
- Domain có bản ghi `A` trỏ về IP public của VPS.
- Firewall cho phép TCP `80`, TCP `443` và UDP `443`.

## 2. Tạo cấu hình bí mật

Sau khi clone/copy source lên server:

```bash
cd /opt/nail
cp .env.example .env
nano .env
```

Tối thiểu phải thay các giá trị sau:

```dotenv
DOMAIN=nails.ten-mien-cua-ban.com
POSTGRES_DB=nail
POSTGRES_USER=nail
POSTGRES_PASSWORD=mat-khau-database-ngau-nhien
SESSION_SECRET=chuoi-ngau-nhien-rat-dai
ADMIN_USERNAME=admin
ADMIN_PASSWORD=mat-khau-admin-ban-dau
SESSION_COOKIE_SECURE=true
```

Có thể tạo chuỗi an toàn bằng:

```bash
openssl rand -hex 32
```

Không commit hoặc gửi file `.env` cho người khác. `ADMIN_PASSWORD` chỉ được dùng
để tạo tài khoản lần đầu; các lần khởi động sau không ghi đè mật khẩu đã đổi
trong trang admin.

## 3. Khởi chạy

Kiểm tra file Compose rồi build:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=100 app caddy
```

Khi cả ba service đã healthy/running:

- Website: `https://<DOMAIN>`
- Admin: `https://<DOMAIN>/admin`
- Health check: `https://<DOMAIN>/healthz`

Caddy chỉ cấp được chứng chỉ sau khi DNS đã trỏ đúng và cổng `80/443` truy cập
được từ Internet.

### Chạy tạm bằng IP, chưa có HTTPS

Trong `.env`, đặt:

```dotenv
DOMAIN=:80
SESSION_COOKIE_SECURE=false
```

Sau đó truy cập `http://<IP-VPS>`. Hãy đổi lại `SESSION_COOKIE_SECURE=true` khi
đã dùng domain và HTTPS.

## 4. Dữ liệu ban đầu

Lần chạy đầu tự tạo schema, tài khoản admin và các setting mặc định. Nếu đây là
website mới và muốn nạp dữ liệu demo:

```bash
docker compose exec app npm run db:seed
```

Chỉ chạy seed trên database mới.

### Chuyển database hiện có

Tạo bản dump PostgreSQL ở máy cũ:

```bash
pg_dump -Fc "$DATABASE_URL" -f nail.dump
```

Copy `nail.dump` lên thư mục dự án trên VPS rồi phục hồi:

```bash
docker compose up -d db
docker compose cp nail.dump db:/tmp/nail.dump
docker compose exec db sh -c \
  'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/nail.dump'
docker compose up -d --build
```

Nếu đã có file trong `public/uploads`, sau khi app chạy hãy copy chúng vào
volume:

```bash
docker compose cp public/uploads/. app:/app/public/uploads/
```

## 5. Cập nhật phiên bản

Luôn backup trước, sau đó:

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app caddy
```

Bước setup khi container khởi động là idempotent: nó bổ sung schema còn thiếu
nhưng không ghi đè tài khoản admin hay setting hiện có.

## 6. Backup và phục hồi

Tạo thư mục backup và dump database:

```bash
mkdir -p backups
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/nail-$(date +%F-%H%M).dump"
```

Backup cả file upload:

```bash
docker compose exec -T app tar czf - -C /app/public/uploads . \
  > "backups/uploads-$(date +%F-%H%M).tar.gz"
```

Phục hồi database:

```bash
docker compose cp backups/nail.dump db:/tmp/nail.dump
docker compose exec db sh -c \
  'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/nail.dump'
```

Phục hồi upload:

```bash
docker compose exec -T app tar xzf - -C /app/public/uploads < backups/uploads.tar.gz
```

## Lệnh vận hành nhanh

```bash
docker compose ps
docker compose logs -f --tail=100
docker compose restart app
docker compose down
```

Không dùng `docker compose down -v` trên server thật vì tùy chọn `-v` xóa các
volume chứa database, upload và chứng chỉ.
