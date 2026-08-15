using System.ComponentModel.DataAnnotations;
using TeamTaskTracker.Models;

namespace TeamTaskTracker.Models.Dtos
{
    public class CreateTaskRequest
    {
        [Required(ErrorMessage = "Title is required.")]
        [StringLength(200, MinimumLength = 1, ErrorMessage = "Title must be between 1 and 200 characters.")]
        public string Title { get; set; } = string.Empty;

        [StringLength(1000, ErrorMessage = "Description cannot exceed 1000 characters.")]
        public string? Description { get; set; }

        [Required(ErrorMessage = "Priority is required.")]
        public Priority Priority { get; set; }
    }
}
