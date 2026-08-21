export type SoftOneBlackBookSystemRegistry =
  | "X.SYS"
  | "ACMD"
  | "COMMAND_SWITCH"
  | "XCO"
  | "PARAMS.CFG"
  | "OBJECT_PARAMETER";


export interface SoftOneBlackBookSystemEntry {
  registry:
    SoftOneBlackBookSystemRegistry;

  key: string;

  description: string;

  page: number;

  section: string;

  dataType?: string;

  scope?: string;

  syntax?: string;

  example?: string;

  notes?: string[];
}


export const SOFTONE_BLACKBOOK_SYSTEM_ENTRIES:
  readonly SoftOneBlackBookSystemEntry[] = [
  /*
   * X.SYS — pages 546-547
   */
  ...[
    ["ACNSCHEMA", "Model of the chart of accounts", "Small Int"],
    ["BRANCH", "Login branch", "Small Int"],
    ["CLIENTDATE", "Login Client Date and Time", "Datetime"],
    ["CMPCURR", "Company currency code", "VarChar(5)"],
    ["COMPANY", "Login company", "Small Int"],
    ["COUNTRY", "Country", "Small Int"],
    ["DBTYPE", "1=ORACLE, 3=MSSQL", "Small Int"],
    ["FISCPRD", "Login fiscal period", "Small Int"],
    ["FISCPRDPAY", "Payroll year", "Small Int"],
    ["FOLDER", "Portfolio", "Small Int"],
    ["FPDATE", "First date of the login period", "Date"],
    ["FPERIOD", "First fiscal period of the login fiscal year", "Small Int"],
    ["FYDATE", "First date of the login fiscal year", "Date"],
    ["GROUPS", "Login user group code", "Small Int"],
    ["ISADMIN", "Returns 1 if login user is administrator", "Small Int"],
    ["LANGEXT", "Login language", "VarChar(5)"],
    ["LOCKFISCPRD", "Locked fiscal period", "Small Int"],
    ["LOGINDATE", "Login date", "Date"],
    ["LPDATE", "Last date of the login period", "Date"],
    ["LPERIOD", "Last fiscal period of the login fiscal year", "Small Int"],
    ["LYDATE", "Last fiscal date of the login fiscal year", "Date"],
    ["MAINCOMPANY", "Parent Company in a Group of Companies schema", "Small Int"],
    ["NFISCPRD", "Next fiscal year", "Small Int"],
    ["PAYCPDATE", "Date for the calculation of payroll period", "Date"],
    ["PAYFPDATE", "First date of the payroll period", "Date"],
    ["PAYLPDATE", "Last date of the payroll period", "Date"],
    ["PAYPERIOD", "Payroll period", "Small Int"],
    ["PAYPRDTYPE", "Payroll period type", "Small Int"],
    ["PERIOD", "Login fiscal period", "Small Int"],
    ["PFISCPRD", "Previous fiscal period", "Small Int"],
    ["PFYDATE", "First date of the previous year", "Date"],
    ["PLYDATE", "Last date of the previous year", "Date"],
    ["RELATEDCMPS", "Relative Companies in Group of Companies schema", "VarChar(1024)"],
    ["SERIALNUM", "Soft1 Serial number", "VarChar(15)"],
    ["SOCASH", "Cash", "Small Int"],
    ["SOCASHUSER", "Cash from user", "Small Int"],
    ["SOCURRENCY", "Currency", "Small Int"],
    ["SYSDATE", "System date", "Date"],
    ["USER", "Login user", "Small Int"],
    ["USERBRANCHES", "Login user branches", "VarChar(1024)"],
    ["USERNAME", "Login user name", "VarChar(30)"],
    ["WHOUSES", "Login warehouse", "VarChar(4000)"],
    ["WRKSTN", "Workstation", "Small Int"],
  ].map(
    ([key, description, dataType]) => ({
      registry:
        "X.SYS" as const,

      key,

      description,

      dataType,

      page:
        [
          "PFISCPRD",
          "PFYDATE",
          "PLYDATE",
          "RELATEDCMPS",
          "SERIALNUM",
          "SOCASH",
          "SOCASHUSER",
          "SOCURRENCY",
          "SYSDATE",
          "USER",
          "USERBRANCHES",
          "USERNAME",
          "WHOUSES",
          "WRKSTN",
        ].includes(
          key,
        )
          ? 547
          : 546,

      section:
        "Appendix / E. X.SYS – System Parameters",

      syntax:
        `:X.SYS.${key}`,
    }),
  ),


  /*
   * ACMD — pages 548-550
   */
  ...[
    ["acAbout", "SoftOne About window"],
    ["acAgentConfigure", "SoftOne Agent Configuration"],
    ["acAgentUninstall", "SoftOne Agent Uninstall"],
    ["acBackup", "Backup database"],
    ["acBuildHtmlDoc", "Create accounting report model"],
    ["acBuildOfflineFile", "Create file for local synchronization"],
    ["acCalcErrors", "Calculation errors of local fields"],
    ["acChangePWD", "Change password"],
    ["acChat", "Support call"],
    ["acCheckCS", "Check client / server connection"],
    ["acCheckDB", "Update database window"],
    ["acCheckForUpdates", "Check for updates"],
    ["acComputerSoft1Address", "View computer soft1 address"],
    ["acConnections", "Connections administration"],
    ["acCreateDB", "Create database tables"],
    ["acCutCompanyData", "Export company data"],
    ["acDesktop", "SoftOne Desktop home page"],
    ["acEditAccess", "Define user access rights"],
    ["acEditUserMenu", "Design user menu"],
    ["acExpBarClose", "Hide menu panel"],
    ["acExport", "Export database tables"],
    ["acFavorites", "Favorite jobs"],
    ["acFullTextSearch", "Enable / Disable database full text search"],
    ["acHelpContents", "Help Contents and index"],
    ["acHistory", "Jobs history window"],
    ["acImpFromClipBoard", "Import XXF from Clipboard"],
    ["acImpFromFile", "Import XXF from file"],
    ["acImport", "Import database tables"],
    ["acKnowBase", "Program knowledge base"],
    ["acLicUse", "Activate product license"],
    ["acMainMenu2", "Display main menu"],
    ["acMemory", "SoftOne Messages window"],
    ["acmMind", "Game Master mind"],
    ["acModifMenu", "Display group / user menu"],
    ["acMP3Player", "MP3 Player"],
    ["acMySoft1", "My installation window"],
    ["acNewLicense", "New license"],
    ["acNewSynchOffline", "Sync offline (client) database (ver. 3.12.508 and newer)"],
    ["acProgramNews", "Program news"],
    ["acRelogin", "Relogin using different credentials"],
    ["acReminder", "Reminder window"],
    ["acRemoteCommands", "Scheduled commands"],
    ["acRemoteConfig", "Design remote commands"],
    ["acRemoteServer", "Remote Server"],
    ["acReportGen", "Custom reports designer"],
    ["acRestore", "Restore database"],
    ["acS1AddOns", "SoftOne Add Ons"],
    ["acSaaSServerLogin", "Saas Server Login"],
    ["acScheduler", "Scheduler"],
    ["acSDKFiles", "Custom SDK Files"],
    ["acSelectTop", "Select Top Entries per Object"],
    ["acSendCustomerMessage", "Send e-mail message to customer"],
    ["acSettings", "Settings"],
    ["acSetupOffline", "Off-Line installation parameters"],
    ["acSetupPrinters", "Printer settings"],
    ["acSQLMonitor", "SQL monitor"],
    ["acSrvAccess", "Define Server access rights"],
    ["acStandard", "Display old menu"],
    ["acStartupSQL", "Startup SQL queries"],
    ["acStatusBar", "Show / Hide status bar"],
    ["acSyncDB", "Update database window"],
    ["acSynchOffLine", "Sync offline (client) database"],
    ["acSynchOnline", "Sync online (server) database"],
    ["acTetris", "Game Tetris"],
    ["acToggleMnu", "Remove menu panel"],
    ["acUpgradeLicense", "Renew licence"],
    ["acUserMenu", "User menu"],
    ["acWebPage", "SoftOne site"],
    ["acWMModules", "Web & Mobile Licences"],
    ["acZReportSignB", "Z Report of the type B electronic signature device"],
  ].map(
    ([key, description]) => ({
      registry:
        "ACMD" as const,

      key,

      description,

      page:
        [
          "acWebPage",
          "acWMModules",
          "acZReportSignB",
        ].includes(
          key,
        )
          ? 550
          : [
              "acMemory",
              "acmMind",
              "acModifMenu",
              "acMP3Player",
              "acMySoft1",
              "acNewLicense",
              "acNewSynchOffline",
              "acProgramNews",
              "acRelogin",
              "acReminder",
              "acRemoteCommands",
              "acRemoteConfig",
              "acRemoteServer",
              "acReportGen",
              "acRestore",
              "acS1AddOns",
              "acSaaSServerLogin",
              "acScheduler",
              "acSDKFiles",
              "acSelectTop",
              "acSendCustomerMessage",
              "acSettings",
              "acSetupOffline",
              "acSetupPrinters",
              "acSQLMonitor",
              "acSrvAccess",
              "acStandard",
              "acStartupSQL",
              "acStatusBar",
              "acSyncDB",
              "acSynchOffLine",
              "acSynchOnline",
              "acTetris",
              "acToggleMnu",
              "acUpgradeLicense",
              "acUserMenu",
            ].includes(
              key,
            )
              ? 549
              : 548,

      section:
        "Appendix / F. ACMD Commands – System Tools",

      syntax:
        `ACMD:${key}`,
    }),
  ),


  /*
   * Command-line switches — pages 564-566.
   */
  ...[
    ["/server", "Runs SoftOne Application Server.", "Xplorer.exe /server"],
    ["/server:XXX", "Runs SoftOne Application Server using XXX IP address or HostName.", "Xplorer.exe /server:XXX"],
    ["/host:XXX", "Runs SoftOne as client and connects to application server XXX.", "Xplorer.exe /host:XXX"],
    ["/port:XXX", "Changes Application Server TCP/IP port to XXX.", "Xplorer.exe /server /port:XXX"],
    ["/install", "Installs SoftOne Application Server as Windows service.", "Xplorer.exe /install"],
    ["/uninstall", "Uninstalls SoftOne Application Server from Windows services.", "Xplorer.exe /uninstall"],
    ["/regserver", "Installs registry keys for COM server and SoftOne file associations.", "Xplorer.exe /regserver"],
    ["/unregserver", "Uninstalls registry keys installed by regserver.", "Xplorer.exe /unregserver"],
    ["/xco:filename.XCO", "Auto-runs an XCO connection file; autologin works when the XCO contains a [LOGIN] section.", "Xplorer.exe /xco:filename.XCO"],
    ["/sxco", "Executes configuration commands using default.xco from the application server folder.", "Xplorer.exe /host:XXX /sxco"],
    ["/balance:X", "Runs SoftOne Balancer for X users.", "Xplorer.exe /balance:10"],
    ["/srvrestart:XXX", "Restarts application server in XXX time intervals.", "Xplorer.exe /srvrestart:10"],
    ["/forceoffline:1", "Forces offline connection mode.", "Xplorer.exe /forceoffline:1"],
    ["/np", "Executes the shell command line followed.", 'Xplorer.exe /np "myfile.xxf"'],
    ["/lang:language", "Defines SoftOne application language.", "Xplorer.exe /lang:eng"],
    ["/xcmd:MenuJob", "Runs and opens a MenuJob after login.", "Xplorer.exe /xcmd:CUSTOMER"],
    ["/hide", "Minimizes SoftOne in Windows tray.", "Xplorer.exe /hide"],
    ["/execute:filename", "Runs a command file using Remote Server/Scheduler-style commands.", "Xplorer.exe /execute:S1Job.txt"],
    ["/pad", "Deprecated SoftOne interface for Windows tablets.", "Xplorer.exe /pad"],
    ["/noversion", "Does not update client files from Application / Cloud Server.", "Xplorer.exe /noversion"],
    ["/refresh", "Forces client update from Application / Cloud Server files.", "Xplorer.exe /refresh"],
    ["/noparams", "Does not load PARAMS.CFG.", "Xplorer.exe /noparams"],
    ["/db:xdbxdrv.bpl", "Used for connections with Oracle database.", "Xplorer.exe /db:xdbxdrv.bpl"],
    ["/webreport:0", "Closes WebServer TCP/IP port 22002.", "Xplorer.exe /webreport:0"],
    ["/webreport:XXX", "Changes WebServer TCP/IP port to XXX.", "Xplorer.exe /webreport:XXX"],
    ["/webfeed:XXX", "Runs SoftOne as web feeder using the defined IP address; default port 22099.", "Xplorer.exe /webfeed:test.oncloud.gr"],
    ["/bam:LOCAL", "Runs BAM locally for testing BAM scenarios.", "Xplorer.exe /BAM:LOCAL"],
    ["/xextui", "Runs SoftOne using the New UI.", "Xplorer.exe /xextui"],
    ["/azconsole", "Runs Azure Console.", "Xplorer.exe /azconsole"],
    ["/cloudusrtimeout:X", "Specifies hours before cloud client termination due to inactivity; default 3.", "Xplorer.exe /cloudusrtimeout:6"],
    ["/usewebview2", "Uses Microsoft Edge as default SoftOne Web browser.", "Xplorer.exe /usewebview2"],
  ].map(
    ([key, description, example]) => ({
      registry:
        "COMMAND_SWITCH" as const,

      key,

      description,

      example,

      page:
        [
          "/xextui",
          "/azconsole",
          "/cloudusrtimeout:X",
          "/usewebview2",
        ].includes(
          key,
        )
          ? 566
          : [
              "/xcmd:MenuJob",
              "/hide",
              "/execute:filename",
              "/pad",
              "/noversion",
              "/refresh",
              "/noparams",
              "/db:xdbxdrv.bpl",
              "/webreport:0",
              "/webreport:XXX",
              "/webfeed:XXX",
              "/bam:LOCAL",
            ].includes(
              key,
            )
              ? 565
              : 564,

      section:
        "Appendix / L. Command Line Switches",
    }),
  ),


  /*
   * XCO — pages 567-569.
   * Only explicit parameter rows, not example-only values.
   */
  ...[
    ["Application", "MPR", "Shows SoftOne Menu", "MPR=MENU"],
    ["Application", "SN", "Current connection SoftOne serial number", "SN=0012345678"],
    ["Application", "IPADDRESS", "Licence Manager IP address", "IPADDRESS=172.23.3.1"],
    ["Application", "AUTOLM", "Autosearch network for Licence Manager (0=No, 1=Yes)", "AUTOLM=0"],
    ["Application", "NAME", "Connection XCO name displayed in login Connection list", "NAME=MyConnectionName"],
    ["Application", "NETLIB", "SoftOne library for custom .NET in/out-process applications", "NETLIB=SoftOne.Lib.dll"],
    ["Application", "NETDLL", "Custom .NET in-process DLL filename", "NETDLL=MyNETdll.dll"],
    ["Application", "PATH", "Application path", "PATH=C:\\Softone"],
    ["Application", "ADDON", "Custom Delphi in-process DLL filename", "ADDON=MYDLL.dll"],
    ["Application", "FORCEOFFLINE", "Forces offline connection mode", "FORCEOFFLINE=1"],
    ["Application", "FORCENETDLL", "Prevents login when in-process .NET DLL cannot initialize", "FORCENETDLL=1"],
    ["Application", "RDEFAULTS", "Display last login data on Login Dialog (default 1)", "RDEFAULTS=1"],
    ["Application", "LANGUAGE", "Login language", "LANGUAGE=GRE"],
    ["Application", "LOCALE", "Locale Identifier (LCID)", "LOCALE=1032"],

    ["DBCONNECT", "TYPE", "Database type: MSSQL or ORACLE", "TYPE=MSSQL"],
    ["DBCONNECT", "SERVER", "Database server", "SERVER=SQLServerName"],
    ["DBCONNECT", "DATABASE", "Database name", "DATABASE=DBName"],
    ["DBCONNECT", "USER", "Database username for MSSQL; database name for Oracle", "USER=sa"],
    ["DBCONNECT", "PASSWORD", "Database user password", "PASSWORD=xxx"],
    ["DBCONNECT", "SQLTIMEOUT", "Remote query timeout in seconds; MSSQL default 600", "SQLTIMEOUT=100"],
    ["DBCONNECT", "COMMANDTIMEOUT", "Wait time before terminating command execution", "COMMANDTIMEOUT=100"],
    ["DBCONNECT", "DRIVER", "Used in Oracle connections", "DRIVER=XDBXDRV.BPL"],
    ["DBCONNECT", "LIBRARYNAME", "Used in Oracle connections", "LIBRARYNAME=dbexpoda.dll"],
    ["DBCONNECT", "VENDORLIB", "Used in Oracle connections", "VENDORLIB=dbexpoda.dll"],
    ["DBCONNECT", "DRIVERFUNC", "Used in Oracle connections", "DRIVERFUNC=getSQLDriverORA"],
    ["DBCONNECT", "RANET", "Used in Oracle connections", ""],

    ["LOGIN", "USERNAME", "Autologin SoftOne user name", "USERNAME=S1UserName"],
    ["LOGIN", "PASSWORD", "Autologin SoftOne user password", "PASSWORD=xxx"],
    ["LOGIN", "COMPANY", "Autologin SoftOne company code", "COMPANY=1000"],
    ["LOGIN", "BRANCH", "Autologin SoftOne branch code", "BRANCH=1000"],
    ["LOGIN", "HIDEBAR", "Hides toolbar", "HIDEBAR=1"],
    ["LOGIN", "HIDEMENU", "Hides SoftOne user menu", "HIDEMENU=1"],
    ["LOGIN", "HIDEXPLORER", "Minimizes SoftOne application to Windows tray", "HIDEXPLORER=1"],
    ["LOGIN", "EXEC", "Executes the following SoftOne command after login", "EXEC=SALDOC[AUTOEXEC=2]"],
  ].map(
    ([scope, key, description, example]) => ({
      registry:
        "XCO" as const,

      scope,

      key,

      description,

      example:
        example || undefined,

      page:
        scope ===
          "Application"
          ? 567
          : scope ===
              "DBCONNECT"
            ? 568
            : 569,

      section:
        `Appendix / M. XCO / ${scope}`,
    }),
  ),


  /*
   * PARAMS.CFG — pages 571-572.
   */
  ...[
    ["PARAMS", "LANG", "Defines SoftOne application language", "LANG:ENG"],
    ["PARAMS", "SERVER", "Runs SoftOne Application Server using defined IP address or HostName", "SERVER:XXX"],
    ["PARAMS", "HOST", "Connects client to Application Server IP address or HostName", "HOST:XXX"],
    ["PARAMS", "PORT", "Changes Application Server TCP/IP port", "PORT:XXX"],
    ["PARAMS", "SAAS", "Connection URL; always use for out-process applications", "SAAS:saas.azure.oncloud.gr"],
    ["PARAMS", "NETLIB", "SoftOne library for custom .NET in/out-process applications", "NETLIB=SoftOne.Lib.dll"],
    ["PARAMS", "NETDLL", "Custom .NET in-process DLL filename", "NETDLL=MyNETdll.dll"],
    ["PARAMS", "ADDON", "Custom Delphi in-process DLL filename", "ADDON=MYDLL.dll"],
    ["PARAMS", "CLOUDUSRTIMEOUT", "Hours until client termination due to inactivity; default 3", "CLOUDUSRTIMEOUT=8"],
    ["PARAMS", "TCPPING", "Client-to-server ping interval in milliseconds; default 40000", "TCPPING=60000"],
    ["PARAMS", "TCPNONEWS", "Client inactivity termination time in milliseconds; must exceed TCPPING", "TCPNONEWS=90000"],

    ["SAAS", "SectionName", "Maps an installation section name to displayed connection name", "MyInstallation=MyInstallation"],

    ["INSTALLATION", "USERNAME", "SoftOne installation username", "USERNAME=Admin"],
    ["INSTALLATION", "PASSWORD", "SoftOne installation password", "PASSWORD=xxx"],
    ["INSTALLATION", "DONTSHOWAGAIN", "Hides the Cloud Login Window", "DONTSHOWAGAIN=1"],
  ].map(
    ([scope, key, description, example]) => ({
      registry:
        "PARAMS.CFG" as const,

      scope,

      key,

      description,

      example,

      page:
        scope ===
          "PARAMS"
          ? 571
          : 572,

      section:
        `Appendix / N. PARAMS.CFG / ${scope}`,
    }),
  ),


  /*
   * Internal Object Parameters — page 573.
   */
  ...[
    ["All", "NOMESSAGES=1", "Disables warning messages raised from SoftOne operational parameters."],
    ["All", "WARNINGS=OFF", "Disables warning messages raised from WARNING fields."],
    ["SALDOC", "NOPROCDEF=1", "Disables execution of credit control scenarios."],
    ["SALDOC", "NOCHECKLIMITS=1", "Disables item quantity checks."],
    ["SALDOC", "ASKTOCHANGEPOLICY=1", "Displays Change policy confirmation message."],
    ["SALDOC", "KEEPHANDPRC=1", "Maintains manually added item price during document recalculation."],
    ["SALDOC", "KEEPHANDSRVPRC=1", "Maintains manually added service price during document recalculation."],
    ["SALDOC", "KEEPHANDDISCPRC1=1", "Prevents manual DISC1PRC from being overwritten during recalculation."],
    ["SALDOC", "KEEPHANDDISCPRC2=1", "Prevents manual DISC2PRC from being overwritten during recalculation."],
    ["SALDOC", "KEEPHANDDISCPRC3=1", "Prevents manual DISC3PRC from being overwritten during recalculation."],
    ["SALDOC", "NOBONUSPOINT=1", "Disables bonus points calculation on document post."],
    ["SALDOC", "AUTOCOVERUSE=1", "Enables Auto Coverage mode using Company Branch."],
    ["SALDOC", "AUTOCOVERUSE=2", "Enables Auto Coverage mode using Customer Branch."],
    ["SALDOC", "AUTOCOVERUSE=3", "Enables Auto Coverage mode using Company Branch and Customer Branch."],
    ["SALDOC", "AUTOTRANSKEEPEXPN=1", "Auto-converted sales documents keep expense data of the converted document."],
    ["SALDOC,PURDOC", "NOSERIESREEVAL=1", "Disables document recalculation when SERIES changes."],
  ].map(
    ([scope, key, description]) => ({
      registry:
        "OBJECT_PARAMETER" as const,

      scope,

      key,

      description,

      page:
        573,

      section:
        "Appendix / O. Internal Object Parameters",
    }),
  ),
];


function normalize(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
}


export function searchSoftOneBlackBookSystemRegistry(
  query: string,
  registry?:
    SoftOneBlackBookSystemRegistry,
): SoftOneBlackBookSystemEntry[] {
  const q =
    normalize(
      query,
    );


  return SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.filter(
    entry =>
      (
        !registry ||
        entry.registry ===
          registry
      ) &&
      [
        entry.key,
        entry.description,
        entry.scope ?? "",
        entry.syntax ?? "",
        entry.example ?? "",
      ].some(
        value =>
          normalize(
            value,
          ).includes(
            q,
          ),
      ),
  );
}


export function findSoftOneBlackBookSystemEntry(
  registry:
    SoftOneBlackBookSystemRegistry,
  key:
    string,
): SoftOneBlackBookSystemEntry[] {
  const wanted =
    normalize(
      key,
    );


  return SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.filter(
    entry =>
      entry.registry ===
        registry &&
      normalize(
        entry.key,
      ) ===
        wanted,
  );
}
