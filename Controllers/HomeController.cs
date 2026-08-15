using Microsoft.AspNetCore.Mvc;

namespace TeamTaskTracker.Controllers
{
    public class HomeController : Controller
    {
        // Serves the single-page task tracker view.
        // The page itself talks to TasksController (/api/tasks) via fetch().
        public IActionResult Index()
        {
            return View();
        }
    }
}
