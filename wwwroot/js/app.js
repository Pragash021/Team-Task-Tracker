(function () {
    const API_BASE = "/api/tasks";
    const SUCCESS_MESSAGE_MS = 3000; // how long "Task added." style messages stay visible

    const form = document.getElementById("task-form");
    const titleInput = document.getElementById("title");
    const descriptionInput = document.getElementById("description");
    const priorityInput = document.getElementById("priority");
    const submitBtn = document.getElementById("submit-btn");
    const titleError = document.getElementById("title-error");
    const descriptionError = document.getElementById("description-error");
    const formError = document.getElementById("form-error");
    const formSuccess = document.getElementById("form-success");

    const loadingState = document.getElementById("loading-state");
    const errorState = document.getElementById("error-state");
    const errorText = document.getElementById("error-text");
    const emptyState = document.getElementById("empty-state");
    const taskList = document.getElementById("task-list");
    const retryBtn = document.getElementById("retry-btn");
    const filterButtons = document.querySelectorAll(".filter-btn");

    const confirmDialog = document.getElementById("confirm-dialog");
    const confirmTaskTitle = document.getElementById("confirm-task-title");
    const confirmOkBtn = document.getElementById("confirm-ok-btn");
    const confirmCancelBtn = document.getElementById("confirm-cancel-btn");
    let pendingCompleteBtn = null; // the "Mark Completed" button awaiting confirmation

    const toastContainer = document.getElementById("toast-container");

    function showToast(message, type) {
        const toast = document.createElement("div");
        toast.className = `toast toast-${type === "error" ? "error" : "success"}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("toast-hide");
            toast.addEventListener("animationend", () => toast.remove());
        }, 3000);
    }

    let currentStatusFilter = "";
    let successTimer = null;

    // Race-condition guard: every call to loadTasks() gets a ticket number.
    // When a fetch resolves, we only apply it to the DOM if it's still the
    // most recent request in flight — stale/late responses are ignored.
    let requestTicket = 0;

    function setListState(state) {
        // state: 'loading' | 'error' | 'empty' | 'list'
        loadingState.hidden = state !== "loading";
        errorState.hidden = state !== "error";
        emptyState.hidden = state !== "empty";
        taskList.hidden = state !== "list";
    }

    function clearFormMessages() {
        titleError.textContent = "";
        descriptionError.textContent = "";
        formError.textContent = "";
        clearFormSuccess();
    }

    function clearFormSuccess() {
        formSuccess.textContent = "";
        if (successTimer) {
            clearTimeout(successTimer);
            successTimer = null;
        }
    }

    function showFormSuccess(message) {
        clearFormSuccess();
        formSuccess.textContent = message;
        successTimer = setTimeout(() => {
            formSuccess.textContent = "";
            successTimer = null;
        }, SUCCESS_MESSAGE_MS);
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str ?? "";
        return div.innerHTML;
    }

    function formatDate(iso) {
        try {
            const d = new Date(iso);
            return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
        } catch {
            return iso;
        }
    }

    function renderTasks(tasks) {
        if (!tasks || tasks.length === 0) {
            setListState("empty");
            return;
        }

        taskList.innerHTML = tasks.map(t => `
            <li class="task-item ${t.status === "Completed" ? "completed" : ""}" data-id="${t.id}">
                <div class="task-main">
                    <p class="task-title">${escapeHtml(t.title)}</p>
                    ${t.description ? `<p class="task-desc">${escapeHtml(t.description)}</p>` : ""}
                    <div class="task-meta">
                        <span class="badge badge-priority-${t.priority}">${t.priority}</span>
                        <span class="badge badge-status-${t.status}">${t.status}</span>
                        <span>Created ${formatDate(t.createdAt)}</span>
                    </div>
                    <p class="task-action-error" data-action-error hidden></p>
                </div>
                ${t.status === "Pending"
                ? `<button type="button" class="complete-btn" data-id="${t.id}">Mark Completed</button>`
                : ""}
            </li>
        `).join("");

        setListState("list");
    }

    async function loadTasks() {
        const myTicket = ++requestTicket;
        setListState("loading");

        try {
            const url = currentStatusFilter
                ? `${API_BASE}?status=${encodeURIComponent(currentStatusFilter)}`
                : API_BASE;

            const res = await fetch(url, { headers: { "Accept": "application/json" } });

            // A newer request has started since this one fired — drop this result.
            if (myTicket !== requestTicket) return;

            if (!res.ok) {
                const body = await safeJson(res);
                throw new Error(body?.message || `Failed to load tasks (HTTP ${res.status}).`);
            }

            const tasks = await res.json();
            if (myTicket !== requestTicket) return; // guard again after the second await

            renderTasks(tasks);
        } catch (err) {
            if (myTicket !== requestTicket) return; // don't show a stale error over fresh data
            errorText.textContent = err.message || "Could not load tasks. Please check your connection and try again.";
            setListState("error");
        }
    }

    async function safeJson(res) {
        try { return await res.json(); } catch { return null; }
    }

    function validateForm() {
        let valid = true;
        clearFormMessages();

        const title = titleInput.value.trim();
        if (!title) {
            titleError.textContent = "Title is required.";
            valid = false;
        } else if (title.length > 200) {
            titleError.textContent = "Title must be 200 characters or fewer.";
            valid = false;
        }

        if (descriptionInput.value.length > 1000) {
            descriptionError.textContent = "Description must be 1000 characters or fewer.";
            valid = false;
        }

        return valid;
    }

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        // Ignore repeat submits while one is already in flight.
        if (submitBtn.disabled) return;

        clearFormMessages();
        if (!validateForm()) return;

        submitBtn.disabled = true;
        submitBtn.textContent = "Adding…";

        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: titleInput.value.trim(),
                    description: descriptionInput.value.trim() || null,
                    priority: priorityInput.value
                })
            });

            const body = await safeJson(res);

            if (!res.ok) {
                const messages = body?.errors?.length ? body.errors.join(" ") : (body?.message || "Could not create task.");
                formError.textContent = messages;
                showToast(messages, "error");
                return;
            }

            showFormSuccess("Task added.");
            showToast("Task added successfully.", "success");
            form.reset();
            priorityInput.value = "Medium";
            await loadTasks();
        } catch (err) {
            formError.textContent = "Network error — could not reach the server.";
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Add Task";
        }
    });

    taskList.addEventListener("click", function (e) {
        const btn = e.target.closest(".complete-btn");
        if (!btn || btn.disabled) return;

        const listItem = btn.closest(".task-item");
        const titleEl = listItem ? listItem.querySelector(".task-title") : null;

        pendingCompleteBtn = btn;
        confirmTaskTitle.textContent = titleEl ? titleEl.textContent : "this task";
        confirmDialog.showModal();
    });

    confirmCancelBtn.addEventListener("click", () => {
        pendingCompleteBtn = null;
        confirmDialog.close();
    });

    // Clicking the backdrop or pressing Esc also cancels — make sure state is reset.
    confirmDialog.addEventListener("close", () => {
        pendingCompleteBtn = null;
    });

    confirmOkBtn.addEventListener("click", async () => {
        const btn = pendingCompleteBtn;
        confirmDialog.close();
        if (!btn) return;

        await completeTask(btn);
    });

    async function completeTask(btn) {
        const id = btn.dataset.id;
        const listItem = btn.closest(".task-item");
        const actionErrorEl = listItem ? listItem.querySelector("[data-action-error]") : null;

        if (actionErrorEl) {
            actionErrorEl.hidden = true;
            actionErrorEl.textContent = "";
        }

        btn.disabled = true;
        btn.textContent = "Updating…";

        try {
            const res = await fetch(`${API_BASE}/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "Completed" })
            });

            if (!res.ok) {
                const body = await safeJson(res);
                throw new Error(body?.message || "Could not update task status.");
            }

            // Success: refresh the whole list from the server so state stays consistent.
            showToast("Task marked as completed.", "success");
            await loadTasks();
        } catch (err) {
            // This is a single-action failure, not a whole-list failure — show it
            // inline on that task only, and leave the rest of the list intact.
            btn.disabled = false;
            btn.textContent = "Mark Completed";
            showToast(err.message, "error");
            if (actionErrorEl) {
                actionErrorEl.hidden = false;
                actionErrorEl.textContent = err.message;
            }
        }
    }

    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentStatusFilter = btn.dataset.status;
            loadTasks();
        });
    });

    retryBtn.addEventListener("click", loadTasks);

    loadTasks();
})();