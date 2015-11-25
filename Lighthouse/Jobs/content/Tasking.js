//More pageination choices!

taskingViewModel.pageSizeChoices.push(200);
taskingViewModel.pageSizeChoices.push(500);
taskingViewModel.pageSizeChoices.push(1000);

var saved = utility.getPrimitiveFromLocalStorage(taskingViewModel.localStorageKeys.JobPageSize);
var selected = taskingViewModel.jobPageSizeChoice.peek();


console.log("saved:"+saved);
console.log("selected:"+selected);

if (saved != selected)
{
console.log("Fixing page size difference");
taskingViewModel.jobPageSizeChoice(saved);
}


