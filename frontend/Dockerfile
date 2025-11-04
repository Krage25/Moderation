# Use official Node.js image
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install autoprefixer@10.4.21 postcss@8.5.4 tailwindcss@3.4.17 lucide-react

# Copy rest of the application
COPY . .

# Build the React app
RUN npm run build

# Use nginx to serve the build files
FROM nginx:alpine

# Copy build output to nginx html folder
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
