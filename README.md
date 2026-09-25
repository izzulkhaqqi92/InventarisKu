# InventarisKu

InventarisKu adalah PWA sistem inventaris barang berbasis HTML, CSS, JavaScript, Supabase PostgreSQL, Supabase Auth, dan Supabase Storage.

## Fitur utama

- Login Supabase Auth; aplikasi terkunci sebelum login.
- Sesi tab maksimal 2 jam dan kontrol 5 kegagalan login / tunggu 2 menit pada sisi aplikasi.
- CRUD barang dan upload gambar ke Supabase Storage.
- Arsip barang untuk menjaga histori stok opname; barang arsip dapat dipulihkan.
- Auto-code berdasarkan kategori, deteksi kategori mirip, dan proteksi bentrok prefix.
- Live validation form.
- Pencarian nama dan kode barang; format `ELK001`, `ELK-001`, dan `ELK 001` saling cocok.
- Filter, sorting, mobile filter collapsed.
- Pagination 10 item per halaman untuk inventaris aktif dan arsip.
- Statistik: jumlah barang per kategori, nilai inventaris per kategori, dan status stok.
- Light / Dark / System theme.
- Backup dan Restore LocalStorage JSON.
- Import CSV/XLSX dengan preview dan validasi; gambar import dikosongkan.
- Export paket ZIP berisi data dan `images/<kategori>/<nama barang>.<ext>`.
- Stok opname: snapshot stok, stok fisik, selisih, draft autosave, finalisasi, riwayat.
- PWA + offline cache.

## Setup database

Project final hanya menggunakan satu file SQL:

`supabase-setup.sql`

File tersebut merupakan schema final lengkap untuk instalasi Supabase baru. Jalankan melalui Supabase -> SQL Editor -> paste seluruh isi -> Run.

Setelah SQL selesai:

1. Pastikan bucket public `barang-images` tersedia di Supabase Storage.
2. Buat minimal satu user email/password melalui Authentication -> Users.
3. Isi `config.js` menggunakan Project URL dan Publishable/anon key. Jangan memakai secret/service_role key pada frontend.
4. Jalankan/deploy aplikasi melalui HTTPS atau localhost.

### Database yang sudah berjalan

Jika database InventarisKu milik Anda sudah pernah dikonfigurasi dan seluruh fitur aplikasi saat ini telah bekerja, **jangan jalankan ulang file SQL hanya karena mengganti frontend**. `supabase-setup.sql` disimpan sebagai definisi schema final dan untuk instalasi baru.

## Format import

Kolom minimal CSV/XLSX:

`Nama Barang`, `Kategori`, `Harga`, `Stok`, `Satuan`, `Supplier`

Kolom opsional:

`Kode Barang`, `Kondisi`, `Lokasi`

Jika `Kode Barang` kosong, aplikasi menghasilkan kode otomatis. Gambar tidak diambil dari file import dan dapat ditambahkan kemudian melalui aplikasi.

## Catatan arsip

Barang yang sudah memiliki relasi dengan histori stok opname tidak dihapus permanen. Barang dipindahkan ke arsip agar histori tetap konsisten. Barang arsip tidak muncul sebagai inventaris aktif dan dapat dipulihkan.

## Splash screen

Splash screen menampilkan icon aplikasi, nama InventarisKu, jenis aplikasi, identitas pembuat, dan animasi loading sederhana sesuai kebutuhan aplikasi.


## Perbaikan v6.3 — gambar barang
- Thumbnail, preview edit, dan detail memakai fallback signed URL dari `gambar_path` jika URL publik gagal.
- Klik thumbnail/detail gambar membuka viewer khusus gambar + nama barang.
- Tidak ada perubahan database/SQL.


## Perbaikan v6.4 — image viewer
- Viewer sekarang memakai URL gambar yang sudah terbukti tampil pada thumbnail/detail sebagai sumber pertama, sehingga tidak menunggu request Storage baru.
- Jika sumber tersebut gagal, aplikasi baru mencoba signed URL dari `gambar_path`.
- Area viewer memakai ukuran eksplisit 100% dengan `object-fit: contain`, sehingga gambar tidak bisa berukuran nol pada grid/modal tertentu.
- Request viewer diberi token agar hasil async dari gambar lama tidak menimpa gambar yang baru dibuka.
- Cache PWA dinaikkan ke v6.4.
