import React, { useState, useEffect } from "react";

const randomEmails = [
  "anitab*****@yahoo.com",
  "anitab*****@yahoo.com",
  "anitad***@shaw.ca",
  "anitae*********@charter.net",
  "anitaj******@townisp.com",
  "anitajn**@yahoo.com",
  "anitajo**@toad.net",
  "anitave*******@verizon.net",
  "anja1g*@yahoo.com",
  "anjane****@bluebottle.com",
  "ank***@yahoo.com",
  "anke**@juno.com",
  "ankusa******@zoominternet.net",
  "ann@ae2.com",
  "ann@meriwether-ga.com",
  "ann@oserpress.com",
  "ann@steinaiken.com",
  "ann.cor*****@verizon.net",
  "ann.ell***@centurytel.net",
  "ann.gre******@ntlworld.com",
  "ann2m***@cablespeed.com",
  "ann75@grandecom.net",
  "ann81624@peoplepc.com",
  "ann_a@msn.com",
  "ann_b**@hotmail.com",
  "ann_be****@hotmail.com",
  "ann_co******@talk21.com",
  "anna@verdickbuilders.com",
  "anna.ak***@heco.com",
  "anna.ba***@charter.net",
  "anna.bl******@comcast.net",
  "anna.do*****@kp.or",
  "anna.do*****@kp.org",
  "anna_ch********@yahoo.com",
  "Anna_de*****@merck.com",
  "anna_la**@yahoo.com",
  "anna_rox@hotmail.com",
  "annaar******@sbcglobal.net",
  "annab****@netscape.net",
  "annabe******@aol.com",
  "annab***@cwpanama.net",
  "annabri******@yahoo.com",
  "annabs**@yahoo.com",
  "annaci*****@ymail.com",
  "annacl*****@genext.net",
  "annaco***@atcjet.net",
  "annad7*****@yahoo.com",
  "annamae@chartertn.net",
  "annands****@juno.com",
  "annarc****@yahoo.ca",
  "annareddy_ravikiran@yahoo.com",
  "annarickf***@comcast.net",
  "annarr*****@aol.com",
  "annb129@yahoo.com",
  "annb***@direcway.com",
  "annbien@cox.net",
  "annblair****@comcast.net",
  "annbloc@yahoo.com",
  "annbroo*********@ims.us",
  "anncla****@peoplepc.com",
  "anncoc******@juno.com",
  "anncoo**@aol.com",
  "anncor******@aol.com",
  "annd@nehe.com",
  "anndan@juno.com",
  "anne@azimagematters.com",
  "anne-marie.vints@uza.be",
  "anne.atwood@gmail.com",
  "anne.buchanan@ncmail.net",
  "anne.chism@tdstelecom.com",
  "anne.davenport@whitehen.com",
  "anne.rush.1024@gmail.com",
  "anne120*****@yahoo.com",
  "anne99748@yahoo.com",
  "anne_du@bhacn.com",
  "anne_n_charleston@yahoo.com",
  "anneabf@cs.com",
  "anneandcrew@juno.com",
  "anneb@arrenalsys.com",
  "annebell*******@yahoo.com",
  "annebos***@bossorealty.com",
  "anneboyea@yahoo.com",
  "annebuda*****@netzero.net",
  "annecra*****@yahoo.com",
  "annedre***@yahoo.com",
  "annefis***@juno.com",
  "annefpgfl@earthlink.net",
  "annefrommaine@yahoo.com",
  "annehussey@rogers.com",
  "anneileen27@yahoo.com",
  "annemarie1127@yahoo.com",
  "annemie@acsalaska.net",
  "anneora1@yahoo.com",
  "annepd99@msn.com",
  "annette.bravo@wellsfargo.com",
  "annette.farmer@pergo.com",
  "annette.smith15@ntlworld.com",
  "annetteal@yahoo.com",
  "annettebuckun@cox.net",
  "annettecantrell@juno.com",
];

// Function to generate random USD amount between 50 and 1000
const generateRandomAmount = () => {
  const amount = (Math.random() * (1000 - 50) + 50).toFixed(2);
  return `$${amount}`;
};

export const RandomUserDisplay = () => {
  const [currentUser, setCurrentUser] = useState({
    email: randomEmails[0],
    amount: generateRandomAmount(),
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * randomEmails.length);
      setCurrentUser({
        email: randomEmails[randomIndex],
        amount: generateRandomAmount(),
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white border border-gray-200 p-2 text-sm animate-fade-in">
      <div className="flex justify-between items-center px-4">
        <div className="text-[#4F9CF9]">{currentUser.email}</div>
        <div className="text-gray-400">{currentUser.amount}Usd</div>
      </div>
    </div>
  );
};
