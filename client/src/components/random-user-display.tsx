import React, { useState, useEffect } from "react";

const randomEmails = [
  "jo**hn.doe@gm**ail.com",
  "sa**rah.smith@y**ahoo.com",
  "mi**ke.jones@h**otmail.com",
  "al**ice.brown@gm**ail.com",
  "em**ily.wilson@o**utlook.com",
  "li**am.martin@y**ahoo.com",
  "da**vid.lee@h**otmail.com",
  "so**phia.clark@gm**ail.com",
  "ja**mes.taylor@o**utlook.com",
  "ch**loe.moore@y**ahoo.com",
  "to**m.jackson@gm**ail.com",
  "ha**nna.white@h**otmail.com",
  "gr**ace.hall@y**ahoo.com",
  "el**la.thomas@o**utlook.com",
  "ma**x.evans@gm**ail.com",
  "ni**ck.carter@h**otmail.com",
  "ol**ivia.murphy@y**ahoo.com",
  "pe**ter.roberts@o**utlook.com",
  "qu**inn.foster@gm**ail.com",
  "ra**chel.morris@h**otmail.com",
  "st**eve.parker@y**ahoo.com",
  "tu**cker.reed@o**utlook.com",
  "vi**ctoria.bell@gm**ail.com",
  "we**ndy.scott@h**otmail.com",
  "xy**la.mason@y**ahoo.com",
  "za**ck.cooper@o**utlook.com",
  "ab**by.ross@gm**ail.com",
  "bc**rian.ward@h**otmail.com",
  "cd**iana.kelly@y**ahoo.com",
  "de**rek.bailey@o**utlook.com",
  "ef**fie.gray@gm**ail.com",
  "fg**rank.morgan@h**otmail.com",
  "gh**azel.king@y**ahoo.com",
  "hi**lary.brooks@o**utlook.com",
  "ij**an.mills@gm**ail.com",
  "jk**eith.russell@h**otmail.com",
  "kl**ara.ellis@y**ahoo.com",
  "lm**ogan.hayes@o**utlook.com",
  "mn**ia.ford@gm**ail.com",
  "no**ah.bennett@h**otmail.com",
  "op**al.perry@y**ahoo.com",
  "pq**aul.hunter@o**utlook.com",
  "qr**istin.cole@gm**ail.com",
  "rs**yan.stewart@h**otmail.com",
  "st**acy.richards@y**ahoo.com",
  "tu**lia.dixon@o**utlook.com",
  "uv**a.henderson@gm**ail.com",
  "vw**ade.phillips@h**otmail.com",
  "wx**ena.bishop@y**ahoo.com",
  "xy**ler.campbell@o**utlook.com",
  "yz**oe.owens@gm**ail.com",
  "za**ra.myers@h**otmail.com",
  "ab**el.stone@y**ahoo.com",
  "bc**lake.fisher@o**utlook.com",
  "cd**ara.graham@gm**ail.com",
  "de**xter.hill@h**otmail.com",
  "ef**ie.rose@y**ahoo.com",
  "fg**inn.watson@o**utlook.com",
  "gh**ia.pearson@gm**ail.com",
  "hi**ram.sanders@h**otmail.com",
  "ij**une.cook@y**ahoo.com",
  "jk**ayden.barnes@o**utlook.com",
  "kl**eopatra.dean@gm**ail.com",
  "lm**iles.warren@h**otmail.com",
  "mn**ira.hudson@y**ahoo.com",
  "no**lan.ellis@o**utlook.com",
  "op**helia.murray@gm**ail.com",
  "pq**uincy.james@h**otmail.com",
  "qr**ose.fleming@y**ahoo.com",
  "rs**amuel.bond@o**utlook.com",
  "st**ella.hawkins@gm**ail.com",
  "tu**cker.nelson@h**otmail.com",
  "uv**i.reynolds@y**ahoo.com",
  "vw**era.walters@o**utlook.com",
  "wx**illiam.grant@gm**ail.com",
  "xy**nona.mcdonald@h**otmail.com",
  "yz**etta.price@y**ahoo.com",
  "za**ne.richardson@o**utlook.com",
  "ab**igail.lynch@gm**ail.com",
  "bc**randon.dunn@h**otmail.com",
  "cd**eleste.hart@y**ahoo.com",
  "de**clan.porter@o**utlook.com",
  "ef**fiona.woods@gm**ail.com",
  "fg**abriel.stevens@h**otmail.com",
  "gh**wen.sullivan@y**ahoo.com",
  "hi**de.rogers@o**utlook.com",
  "ij**ris.matthews@gm**ail.com",
  "jk**asper.coleman@h**otmail.com",
  "kl**ylie.holmes@y**ahoo.com",
  "lm**axwell.fowler@o**utlook.com",
  "mn**ina.simmons@gm**ail.com",
  "no**ra.burke@h**otmail.com",
  "op**al.garrett@y**ahoo.com",
  "pq**rest.wheeler@o**utlook.com",
  "qr**iana.silva@gm**ail.com",
  "rs**uby.hansen@h**otmail.com",
  "st**anley.mcdaniel@y**ahoo.com",
  "tu**lip.parker@o**utlook.com",
  "uv**incent.carroll@gm**ail.com",
  "vw**endy.lawson@h**otmail.com"
]
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
    <div className="border border-gray-200 p-2 text-sm animate-fade-in bg-black/20 backdrop-blur-md">
      <div className="flex justify-between items-center px-4">
        <strong className="text-black">{currentUser.email}</strong>
        <strong className="text-green-400">{currentUser.amount}Usd</strong>
      </div>
    </div>
  );
};
