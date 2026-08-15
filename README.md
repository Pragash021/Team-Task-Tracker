# Team Task Tracker

A small full-stack app for creating, listing, filtering, and completing team tasks.

**Stack:** ASP.NET Core 8 (MVC + Web API, same project), Entity Framework Core, MSSQL, vanilla JS/HTML/CSS frontend served from `wwwroot` + Razor views.

---

## 1. Installation & Startup

### Prerequisites
- Visual Studio 2022 (17.8+) with the **ASP.NET and web development** workload
- .NET 8 SDK (installed automatically by the VS2022 installer if missing)
- SQL Server (LocalDB, SQL Express, or a named instance — e.g. `HARRY`, `HARRY\SQLEXPRESS`)

### Steps
1. Open `TeamTaskTracker.sln` in Visual Studio 2022. NuGet packages restore automatically (EF Core SQL Server, EF Core Tools, Swashbuckle). If not, right-click the solution → **Restore NuGet Packages**.
2. Open `appsettings.json` and set `ConnectionStrings:DefaultConnection` to match your SQL Server instance, e.g.:
   ```json
   "DefaultConnection": "Server=HARRY;Database=TeamTaskTrackerDb;Trusted_Connection=True;TrustServerCertificate=True"
   ```
   `TrustServerCertificate=True` avoids the "Encryption was enabled..." SSL error on local dev instances with a self-signed certificate.
3. Create the database schema — pick one:
   - **EF Core migrations (recommended):** **Tools → NuGet Package Manager → Package Manager Console**, then:
     ```
     Add-Migration InitialCreate
     Update-Database
     ```
   - **Raw SQL:** run `Database/schema.sql` against your instance instead.
   `Program.cs` also runs `db.Database.Migrate()` automatically on startup once a migration exists.
4. Press **F5**. On first run, Visual Studio may prompt to trust the local HTTPS dev certificate — click **Yes** (this is a one-time, standard .NET dev prompt, safe for `localhost`).
5. Your browser opens automatically to the app.

### Frontend/backend — same project
This app hosts both the UI and the API from a single ASP.NET Core project, so "frontend" and "backend" run on the same URL/port — there's no separate frontend server to start.

---

## 2. URLs & Endpoints

- **Frontend (task list + form):** `https://localhost:5001/`
- **Backend / API base URL:** `https://localhost:5001/api/tasks`
- **Swagger (API explorer):** `https://localhost:5001/swagger`

| Method | Route                        | Description                                              |
|--------|-------------------------------|------------------------------------------------------------|
| GET    | `/api/tasks`                 | List all tasks                                              |
| GET    | `/api/tasks?status=Pending`  | List tasks filtered by status (`Pending` / `Completed`)     |
| GET    | `/api/tasks/{id}`            | Get a single task by id                                     |
| POST   | `/api/tasks`                  | Create a new task                                            |
| PATCH  | `/api/tasks/{id}/status`     | Update a task's status                                       |
| DELETE | `/api/tasks/{id}`            | Delete a task (convenience endpoint)                          |

---

## 3. API Examples

### Valid request

`POST /api/tasks`
```json
{
  "title": "Prepare weekly report",
  "description": "Summarize sprint progress for stakeholders",
  "priority": "High"
}
```

Response `201 Created`
```json
{
  "id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "title": "Prepare weekly report",
  "description": "Summarize sprint progress for stakeholders",
  "priority": "High",
  "status": "Pending",
  "createdAt": "2026-08-15T09:12:00Z",
  "updatedAt": null
}
```

### Error response

`POST /api/tasks` with an empty title:
```json
{ "title": "", "priority": "Low" }
```

Response `400 Bad Request`
```json
{
  "message": "Validation failed.",
  "errors": [
    "The Title field is required.",
    "Title must be between 1 and 200 characters."
  ]
}
```

`PATCH /api/tasks/{id}/status` for a non-existent id returns `404 Not Found`:
```json
{ "message": "Task with id '...' was not found." }
```

---

## 4. Request Flow

`User action → JS component → API request → MVC/API route → stored data → API response → UI update`

1. **User action:** user fills the New Task form and clicks **Add Task**, or clicks **Mark Completed** on a task (which opens a confirmation dialog first), or clicks a status filter button.
2. **Frontend component:** `wwwroot/js/app.js` intercepts the event. For the form, it validates client-side first (title required, length limits) and stops without a network call if invalid. For "Mark Completed," it opens a `<dialog>` confirmation popup and waits for the user to confirm before doing anything.
3. **API request:** on confirmation/valid submit, `app.js` calls `fetch()` — `POST /api/tasks` to create, `PATCH /api/tasks/{id}/status` to complete, or `GET /api/tasks?status=...` to filter.
4. **Backend route:** ASP.NET Core routes the request to `TasksController` (`Controllers/Api/TasksController.cs`), which re-validates the DTO server-side via data annotations and `ModelState` — never trusting client-side validation alone.
5. **Stored data:** on success, the controller maps the request into a `TaskItem` entity (generating `Id`/`CreatedAt` server-side for creates), and persists it through `AppDbContext` (EF Core) into the MSSQL `Tasks` table.
6. **API response:** the controller returns a `TaskResponse` DTO as JSON with the correct HTTP status (`200`, `201`, `400`, `404`).
7. **UI update:** `app.js` reads the response. On success it shows a popup toast notification (top-right) plus an inline message, and re-fetches the task list so the UI reflects the database. On failure it shows the returned error message(s) inline (and as an error toast) without crashing — a failed single action (like completing one task) only shows an error next to that task, it doesn't disrupt the rest of the list. The list itself always reflects one of four states: **loading**, **error** (with retry), **empty**, or **populated list**.

---

## 5. Production Improvements

This is a scoped assessment build. For production I'd add:

- **Database:** move from local SQL Server to a managed instance (Azure SQL / RDS), add a proper migrations deployment pipeline, and add optimistic concurrency (`RowVersion`) to avoid lost updates on the status field.
- **Authentication/authorization:** ASP.NET Core Identity or JWT/OAuth (e.g. Azure AD) so tasks are scoped per user/team, with role-based access for who can create/complete tasks.
- **Automated tests:** unit tests for controller/business logic (xUnit + EF Core InMemory or test containers), integration tests via `WebApplicationFactory`, and frontend tests (e.g. Playwright) covering the form, filters, and confirm-dialog flow.
- **Logging & monitoring:** structured logging (Serilog) shipped to a central sink (Application Insights / ELK), plus health check endpoints (`/health`).
- **Validation & resilience:** centralized exception-handling middleware returning consistent error shapes, FluentValidation for richer rules, and rate limiting (`Microsoft.AspNetCore.RateLimiting`) on the API.
- **Deployment:** containerize with Docker, CI/CD pipeline (GitHub Actions/Azure DevOps) running build + tests + EF migrations, deploy to Azure App Service/Kubernetes behind HTTPS with secrets in Key Vault instead of `appsettings.json`.
- **Frontend:** migrate the vanilla JS layer to React/Blazor as the team/UI grows, add pagination/sorting for large task lists, and optimistic UI updates.
