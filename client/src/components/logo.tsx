
import React from "react";
import logo from "./logo.png";

interface LogoProps {
  size?: "small" | "medium" | "large";
}

const Logo: React.FC<LogoProps> = ({ size = "medium" }) => {
  // Size mappings
  const sizes = {
    small: {
      container: "p-2",
      image: "w-22 h-20",
      text: "text-sm",
    },
    medium: {
      container: "p-3",
      image: "w-25 h-25",
      text: "text-xl",
    },
    large: {
      container: "p-4",
      image: "w-30 h-30",
      text: "text-2xl",
    },
  };

  return (
    <div className="flex items-center space-x-2">
      <img 
        src={logo} 
        alt="Pay TenTen Logo" 
        className={`${sizes[size].image} object-contain`}
      />

    </div>
  );
};

export default Logo;
