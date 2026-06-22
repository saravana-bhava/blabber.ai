// components/ui/StatCard.tsx
import React from "react";
import { motion } from "framer-motion";

interface StatCardProps {
  icon: React.ReactNode;
  stat: string;
  description: string;
}

export function StatCard({ icon, stat, description }: StatCardProps) {
  return (
    <motion.div
      className="bg-foreground p-8 rounded-2xl w-full"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <div className="inline-flex text-background items-center justify-center w-12 h-12 rounded-full bg-foreground/50 mb-6 border border-background/20">
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-background mb-2">{stat}</h3>
      <p className="text-background/60 leading-relaxed">{description}</p>
    </motion.div>
  );
}
