Option Explicit
On Error Resume Next

Dim appRef
Dim desc

Dim WshArguments, i, list, FSO, f, CurrentPath
set WshArguments=WScript.Arguments

Set appRef = CreateObject("Photoshop.Application")
Set desc = CreateObject("Photoshop.ActionDescriptor")
if WshArguments.count()> 0 then
    desc.putBoolean appRef.stringIDToTypeID("args"), true
End if
appRef.executeAction appRef.stringIDToTypeID("338cc304-fb6f-4b1f-8ad4-13bbd65f117c"), desc, 3
