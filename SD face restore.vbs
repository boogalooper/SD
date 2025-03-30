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
appRef.executeAction appRef.stringIDToTypeID("e29b10c8-a069-4e9c-bc6f-426c5ae0f90e"), desc, 3
