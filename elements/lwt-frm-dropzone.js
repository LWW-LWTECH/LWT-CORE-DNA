/* Default file input functionality
Should be compatible with standard web forms.
This element should be called lwtf-dropzone with css variables --lwt-dropzone
popup errors should be an inline message under the drop zone.
invalid files should just be skipped and not added to the list.

accept:
  - optional comma separated list of accepted file types jpeg, png, etc.
  - If the list is limited to a specific file type, then show a message under the drop zone indicating the accepted file types.
  - if the file dropped file is not accepted type, popup error indicating the file is not accepted.
  - Bare words get a dot added, and MIME types like image/* also work.
  - jpeg and jpg count as the same type, as do tif and tiff.
  - The hint shows whenever accept is set, as “Accepted: JPG, PNG”.
  - do not accept folders.

max-size: 
  - optional maximum file size in bytes
  - if a max is provided. append a message under the drop zone indicating the maximum file size.

multiple: 
  - optional boolean attribute to allow multiple file selection
  - if multiple is not set, only allow a single file to be selected, replace the one already present.

name: 
  - optional name attribute for the input element
  - Only accept files with different src file names and file types as specified in the accept attribute.

required: 
  - optional boolean attribute to make the input required

disabled: 
  - optional boolean attribute to disable the input

On file drop:
  - show the file in a list below the drop zone. 
  - The list should show 3 files then the list becomes scrollable.
  - list items should show the file name and size auto calculated to be readable (e.g., KB, MB). 1024 per KB
  - list items should have option to remove the file.
  - if the file dropped exceeds the max size, popup error indicating the file is too large.
  - Layout: column 1 is the image preview thumbnail. column 2 is a stack of the file name and size, then under that is the progress bar. column 3 is the remove button. [x]
  - Images should show a preview thumbnail in the file list to the left of the progress bar.

Dropped state: 
  - The dropzone should visually indicate when a file has been successfully dropped, separate from the drag-over state.
  - a brief highlight of about one second after a successful drop, separate from the drag-over highlight.

Disabled: 
  - the drop zone can’t be tabbed to, drops are ignored, and remove buttons are disabled.
  
Interactions:
  - The dropzone should be mouse clickable and launch the file browser window.
  - The dropzone should have a focus when user tabs through form and they can click enter when in focus.
  - Screen reader should be notified of file drop events and errors.
  - The file list should also be tabbable to select the remove button for each file, then enter to activate it.
  - Tab goes to the drop zone, then each row's remove button in the file list.
  - If the user removes a focused line item, the focus should go back to the drop zone.
  - the element frees each image’s memory when its row is removed.

Form compatibility: 
  - files are submitted as real files. 
  - Validation should be handled according to the standard web form rules.
  - The docs need to say the <form> must have enctype="multipart/form-data" for a normal post. 
  - form.reset() clears the list, and the element has a .name property.
  - Provide a developer a method to animate the upload progress.
*/