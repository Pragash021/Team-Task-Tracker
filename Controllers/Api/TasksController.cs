using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamTaskTracker.Data;
using TeamTaskTracker.Models;
using TeamTaskTracker.Models.Dtos;

namespace TeamTaskTracker.Controllers.Api
{
    [ApiController]
    [Route("api/tasks")]
    [Produces("application/json")]
    public class TasksController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILogger<TasksController> _logger;

        public TasksController(AppDbContext db, ILogger<TasksController> logger)
        {
            _db = db;
            _logger = logger;
        }

        /// <summary>
        /// GET /api/tasks?status=Pending|Completed
        /// Returns all tasks, optionally filtered by status, newest first.
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<TaskResponse>), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> GetTasks([FromQuery] string? status)
        {
            IQueryable<TaskItem> query = _db.Tasks.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!Enum.TryParse<TaskStatusType>(status, true, out var parsedStatus))
                {
                    return BadRequest(new ApiErrorResponse
                    {
                        Message = "Invalid status filter.",
                        Errors = new[] { $"'{status}' is not a valid status. Use 'Pending' or 'Completed'." }
                    });
                }
                query = query.Where(t => t.Status == parsedStatus);
            }

            var tasks = await query
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => TaskResponse.FromEntity(t))
                .ToListAsync();

            return Ok(tasks);
        }

        /// <summary>
        /// GET /api/tasks/{id}
        /// </summary>
        [HttpGet("{id:guid}")]
        [ProducesResponseType(typeof(TaskResponse), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetTaskById(Guid id)
        {
            var task = await _db.Tasks.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
            if (task is null)
            {
                return NotFound(new ApiErrorResponse { Message = $"Task with id '{id}' was not found." });
            }
            return Ok(TaskResponse.FromEntity(task));
        }

        /// <summary>
        /// POST /api/tasks
        /// Creates a new task. The server generates the Id and CreatedAt.
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(TaskResponse), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> CreateTask([FromBody] CreateTaskRequest? request)
        {
            if (request is null)
            {
                return BadRequest(new ApiErrorResponse { Message = "Request body is required." });
            }

            if (!ModelState.IsValid)
            {
                var errors = ModelState.Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage)
                    .ToList();

                return BadRequest(new ApiErrorResponse { Message = "Validation failed.", Errors = errors });
            }

            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = request.Title.Trim(),
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
                Priority = request.Priority,
                Status = TaskStatusType.Pending,
                CreatedAt = DateTime.UtcNow
            };

            _db.Tasks.Add(task);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Task {TaskId} created with title '{Title}'.", task.Id, task.Title);

            var response = TaskResponse.FromEntity(task);
            return CreatedAtAction(nameof(GetTaskById), new { id = task.Id }, response);
        }

        /// <summary>
        /// PATCH /api/tasks/{id}/status
        /// Updates only the status of an existing task (e.g. Pending -> Completed).
        /// </summary>
        [HttpPatch("{id:guid}/status")]
        [ProducesResponseType(typeof(TaskResponse), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest? request)
        {
            if (request is null || !ModelState.IsValid)
            {
                var errors = ModelState.Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage)
                    .ToList();

                return BadRequest(new ApiErrorResponse
                {
                    Message = "Validation failed.",
                    Errors = errors.Count > 0 ? errors : new List<string> { "A valid 'status' value is required." }
                });
            }

            var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id);
            if (task is null)
            {
                return NotFound(new ApiErrorResponse { Message = $"Task with id '{id}' was not found." });
            }

            task.Status = request.Status;
            task.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            _logger.LogInformation("Task {TaskId} status changed to {Status}.", task.Id, task.Status);

            return Ok(TaskResponse.FromEntity(task));
        }

        /// <summary>
        /// DELETE /api/tasks/{id}
        /// Optional convenience endpoint for removing a task.
        /// </summary>
        [HttpDelete("{id:guid}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteTask(Guid id)
        {
            var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id);
            if (task is null)
            {
                return NotFound(new ApiErrorResponse { Message = $"Task with id '{id}' was not found." });
            }

            _db.Tasks.Remove(task);
            await _db.SaveChangesAsync();

            return NoContent();
        }
    }
}
