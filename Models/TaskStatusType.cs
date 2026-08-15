namespace TeamTaskTracker.Models
{
    // Named "TaskStatusType" rather than "TaskStatus" to avoid colliding
    // with System.Threading.Tasks.TaskStatus.
    public enum TaskStatusType
    {
        Pending,
        Completed
    }
}
