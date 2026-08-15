using System.ComponentModel.DataAnnotations;
using TeamTaskTracker.Models;

namespace TeamTaskTracker.Models.Dtos
{
    public class UpdateStatusRequest
    {
        [Required(ErrorMessage = "Status is required.")]
        public TaskStatusType Status { get; set; }
    }
}
