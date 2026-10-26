using System;
using System.IO;
class FakeAdb {
  static int Main(string[] a) {
    string dir=Environment.GetEnvironmentVariable("FAKE_ADB_DIR"), mode=Environment.GetEnvironmentVariable("FAKE_ADB_MODE") ?? "ok";
    string map=Path.Combine(dir,"mapping.txt");
    string fw=Path.Combine(dir,"forward.txt"),port=Environment.GetEnvironmentVariable("FAKE_CDP_PORT") ?? "9338";
    if(a.Length==2 && a[0]=="forward" && a[1]=="--list"){if(File.Exists(fw))Console.WriteLine("FAKEUSB tcp:"+port+" localabstract:chrome_devtools_remote");return 0;}
    if(a.Length>=4 && a[2]=="forward"){
      if(a[3]=="--no-rebind"){File.WriteAllText(fw,"owned");Console.WriteLine(port);return 0;}
      if(a[3]=="--remove"){File.Delete(fw);return 0;}
    }
    if(a.Length==1 && a[0]=="devices") {
      Console.WriteLine("List of devices attached");
      if(mode=="none")return 0;
      Console.WriteLine("FAKEUSB\t"+(mode=="unauthorized"?"unauthorized":"device"));
      if(mode=="multiple")Console.WriteLine("FAKEUSB2\tdevice"); return 0;
    }
    if(a.Length==2 && a[0]=="-d") {Console.WriteLine("device");return 0;}
    if(a.Length>=4 && a[2]=="reverse") {
      if(a[3]=="--list"){if(File.Exists(map))Console.WriteLine("FAKEUSB "+File.ReadAllText(map));return 0;}
      if(a[3]=="--no-rebind"){if(File.Exists(map))return 1;File.WriteAllText(map,"tcp:4182 tcp:4182");return 0;}
      if(a[3]=="--remove"){File.Delete(map);return 0;}
    }
    return 1;
  }
}
