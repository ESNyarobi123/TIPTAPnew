# TIPTAP — Docker

## Endesha stack nzima

Kutoka **mizizi ya mradi** (`TIPTAP/`):

```bash
docker compose -f infra/docker/docker-compose.yml up --build -d
```

- **Web:** http://localhost:3001  
- **API:** http://localhost:3000/api/v1  
- **Swagger:** http://localhost:3000/docs  
- **Health:** http://localhost:3000/health  

API inaendesha **`prisma migrate deploy`** kila inapoanzishwa (ndani ya `docker-entrypoint.sh`).

## Seed (data ya mfano + super admin)

Usiendeshe `pnpm db:seed` kwenye Mac moja kwa moja ikiwa `DATABASE_URL` ya ndani ya host **si** ile ya Postgres ya Docker — utapata *denied access*.

Badala yake, tumia huduma ya Docker inayounganisha **kwenye `postgres` ya ndani ya network**:

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres redis api
docker compose -f infra/docker/docker-compose.yml --profile seed run --rm seed
```

Ukiwa tayari una stack kamili juu, ni lazima tu **seed** (postgres lazima iwe healthy):

```bash
docker compose -f infra/docker/docker-compose.yml --profile seed run --rm seed
```

Huduma ya `seed` inabidi **isimbue ENTRYPOINT** ya picha ya API — la sivyo Docker huanzisha Nest badala ya `prisma db seed`. Hii tayari imesuluhishwa kwenye `docker-compose.yml` (`entrypoint: sh -c '... prisma db seed'`).

Kisha ingia kwa akaunti za mfano (kutoka seed), mfano:

- `admin@tiptap.local` / `ChangeMe!123` (isipokuwa umesajili barua hii kabla — huchorewi upya; angalia hapa chini)  
- `owner.harbor@tiptap.local` / `TenantOwner!123`  

### “Invalid credentials” kwa admin

- **Ulijisajili kabla** kwa `admin@tiptap.local`? Nenosiri si `ChangeMe!123` — tumia lile ulioweka, au weka upya seed:
  ```bash
  SEED_RESET_ADMIN_PASSWORD=true docker compose -f infra/docker/docker-compose.yml --profile seed run --rm seed
  ```
- **Seed haijaendeshwa** au database tofauti: endesha seed tena (sehemu ya juu).
- **Jaribisha owner** wa demo: `owner.harbor@tiptap.local` / `TenantOwner!123`

## Simamisha

```bash
docker compose -f infra/docker/docker-compose.yml down
```

Kufuta data ya Postgres pia:

```bash
docker compose -f infra/docker/docker-compose.yml down -v
```

## Kila kitu kipya (ukishindwa login / Docker “haijarestart vizuri”)

Kutoka **mizizi ya mradi** `TIPTAP/`:

```bash
bash infra/docker/restart-fresh.sh
```

Hii hufanya `down -v`, `up --build -d`, inasubiri `/health`, kisha **seed** yenye `SEED_RESET_ADMIN_PASSWORD=true`. Baada ya hapo tumia:

`admin@tiptap.local` / `ChangeMe!123`

Ikiwa bado kuna tatizo, angalia mchakato:

```bash
docker compose -f infra/docker/docker-compose.yml ps
docker compose -f infra/docker/docker-compose.yml logs --tail=80 api
```

## Kumbuka

- Brava za **JWT** za defaults ni za dev tu; uzalishaji utumie siri zeref.  
- **Web** imejengwa na `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1` kwa sababu kivinjari kinaita API kwenye mashine yako, si jina la huduma ya ndani `api`.

## 401 kwenye `POST /auth/login`

**401** = API imepokea ombi (*si* tatizo la CORS); **barua pepe au nenosiri si sahihi** kwa database ambayo **API ya Docker** inaunganishayo.

1. **Nenosiri lazima iwe na angalau herufi 10** (validate kwenye API) — `ChangeMe!123` inatosha.
2. Thibitisha seed imefanikiwa na admin yuko DB:
   ```bash
   docker compose -f infra/docker/docker-compose.yml exec postgres psql -U postgres -d tiptap -c 'SELECT email FROM "User" WHERE "deletedAt" IS NULL;'
   ```
3. Jaribio kutoka terminal (**bila** browser):
   ```bash
   curl -sS -X POST http://127.0.0.1:3000/api/v1/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"admin@tiptap.local","password":"ChangeMe!123"}'
   ```
   Ukiiona `accessToken`, API ni sawa — angalia ulichopiga kwenye fomu (spacing, barua pepe).
4. Fanya **database safi + seed**: `bash infra/docker/restart-fresh.sh`
