"use client";

import { Box, Typography, Button } from "@mui/material";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import { Pagination, Autoplay } from "swiper/modules";

// MUI Icons
import MedicationIcon from "@mui/icons-material/Medication";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ChatIcon from "@mui/icons-material/Chat";
import HistoryIcon from "@mui/icons-material/History";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import SensorOccupiedIcon from "@mui/icons-material/SensorOccupied"; // ✅ fixed
import CloudQueueIcon from "@mui/icons-material/CloudQueue";         // ✅ fixed
import InsightsIcon from "@mui/icons-material/Insights";
import GroupIcon from "@mui/icons-material/Group";

export default function LandingPage() {
  const features = [
    {
      title: "Medicine Reminders",
      desc: "Patients get timely reminders and logs are stored automatically.",
      icon: <MedicationIcon fontSize="large" color="primary" />,
    },
    {
      title: "Emergency Alerts",
      desc: "Caregivers receive real-time alerts if a patient presses the emergency button.",
      icon: <WarningAmberIcon fontSize="large" color="error" />,
    },
    {
      title: "Caregiver Communication",
      desc: "Caregivers can send messages directly to the patient's device screen.",
      icon: <ChatIcon fontSize="large" color="success" />,
    },
    {
      title: "Automatic Medicine Logging",
      desc: "Each time a button is pressed, the event is logged with timestamp in the database.",
      icon: <HistoryIcon fontSize="large" color="secondary" />,
    },
    {
      title: "Live Device Monitoring",
      desc: "Caregivers can track device activity and ensure patients are following schedules.",
      icon: <SensorOccupiedIcon fontSize="large" sx={{ color: "#009688" }} />, // ✅ fixed
    },
    {
      title: "Secure Cloud Storage",
      desc: "All patient data, logs, and messages are stored securely in Firebase.",
      icon: <CloudQueueIcon fontSize="large" color="info" />, // ✅ fixed
    },
    {
      title: "Analytics Dashboard",
      desc: "Caregivers can analyse medicine intake trends with visual reports and charts.",
      icon: <InsightsIcon fontSize="large" sx={{ color: "#6a1b9a" }} />,
    },
    {
      title: "Multi-Device Support",
      desc: "One caregiver can manage multiple patients and devices from a single dashboard.",
      icon: <GroupIcon fontSize="large" color="primary" />,
    },
  ];

  return (
    <Box sx={{ textAlign: "center", mt: 5, px: 2 }}>
      {/* Heading */}
      <Typography
        variant="h3"
        gutterBottom
        sx={{
          fontWeight: "bold",
          color: "primary.main",
          textShadow: "1px 1px 2px rgba(0,0,0,0.2)",
        }}
      >
        🏥 Smart Medicine Box
      </Typography>
      <Typography
        variant="h6"
        sx={{ mb: 4, maxWidth: 700, mx: "auto", color: "text.secondary" }}
      >
        A smart IoT-based system for patient medicine tracking and caregiver communication.
      </Typography>

      {/* Swiper Carousel */}
      <Box sx={{ maxWidth: 600, mx: "auto", mb: 5 }}>
        <Swiper
          modules={[Pagination, Autoplay]}
          spaceBetween={30}
          slidesPerView={1}
          pagination={{ clickable: true }}
          autoplay={{
            delay: 3000,
            disableOnInteraction: false,
          }}
          loop={true}
        >
          {features.map((f, i) => (
            <SwiperSlide key={i}>
              <Box
                sx={{
                  bgcolor: "background.paper",
                  p: 5,
                  borderRadius: 4,
                  boxShadow: 5,
                  minHeight: 200,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  transition: "all 0.3s ease-in-out",
                  "&:hover": {
                    transform: "translateY(-6px)",
                    boxShadow: 8,
                  },
                }}
              >
                <Box sx={{ mb: 2 }}>{f.icon}</Box>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: "bold", mb: 1, color: "primary.main" }}
                >
                  {f.title}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {f.desc}
                </Typography>
              </Box>
            </SwiperSlide>
          ))}
        </Swiper>
      </Box>

      {/* Call to Action */}
      <Button
        variant="contained"
        color="primary"
        size="large"
        component={Link}
        href="/login"
        sx={{
          px: 4,
          py: 1.5,
          fontSize: "1.1rem",
          borderRadius: 3,
          boxShadow: 4,
          "&:hover": { boxShadow: 6 },
        }}
      >
        🚀 Sign in as Caregiver
      </Button>
    </Box>
  );
}
