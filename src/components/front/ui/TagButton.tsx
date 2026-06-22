import React from "react";

interface TagButtonProps {
  label: string;
  withIcon?: boolean;
  icon?: React.ReactNode; // Custom icon passed as JSX
}

const TagButton = ({ label, withIcon = false, icon }: TagButtonProps) => {
  return (
    <div
      className={`inline-flex items-center px-4 py-2 mb-6 rounded-full border text-sm font-medium transition-colors duration-300
        ${
          withIcon
            ? "space-x-2 border-gray-200 text-foreground-700 hover:bg-gray-50 hover:text-background"
            : "border-gray-300 text-gray-600 hover:bg-gray-100"
        }`}
    >
      {withIcon &&
        (icon ?? (
          // Default fallback icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="14" rx="2" ry="2" />
            <path d="M7 21h10l-5-6z" />
          </svg>
        ))}
      <span>{label}</span>
    </div>
  );
};

export default TagButton;
